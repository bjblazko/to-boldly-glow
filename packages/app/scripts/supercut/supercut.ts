// The supercut for the product page and social media: `npm run supercut -- landscape` (1920×1080)
// or `-- portrait` (1080×1920, for Instagram) in packages/app.
//
// Starts the app's dev server, drives the app scene by scene in Chrome and records what it paints
// (the DevTools screencast, with timestamps) only while a scene runs, so the setting up is not in
// the film. Every cut falls on a bar of the soundtrack: Nova, the app's own lo-fi house track,
// rendered offline by the same synthesizer, with Lyra's lines over it (spoken beforehand into
// voice/ by `synthesize.py speak`, see lines.json) and the music stepping back under her. ffmpeg
// lays the frames out at 30 fps and mixes the sound into an H.264/AAC MP4 in out/.
// Needs ffmpeg and Chrome (the scene uses WebGPU).

import { chromium, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { SCENES } from './scenes'
import { caption, endCard, wait } from './stage'
import { BAR, KEEP_NAMES, mixSoundtrack, renderMusic } from './soundtrack'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../..')
const FPS = 30
const END_BARS = 2
const FORMATS = {
  landscape: { view: { width: 1280, height: 720 }, scale: 1.5 },
  portrait: { view: { width: 540, height: 960 }, scale: 2 },
} as const

interface Recording {
  on: boolean
  frames: { t: number; data: string; segment: number }[]
  segments: number[]
  start(seconds: number): Promise<void>
  stop(): void
  end(): Promise<unknown>
}

async function main(): Promise<void> {
  const format = (process.argv[2] ?? 'landscape') as keyof typeof FORMATS
  if (!(format in FORMATS)) throw new Error(`Unknown format ${format}: landscape or portrait`)
  const { view, scale } = FORMATS[format]
  const tmp = mkdtempSync(path.join(tmpdir(), 'tbg-supercut-'))
  const server = await createServer({ root: APP, logLevel: 'error', server: { port: 0 } })
  await server.listen()
  const base = server.resolvedUrls!.local[0].replace(/\/$/, '')
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required'] })
  try {
    const context = await browser.newContext({ viewport: view, deviceScaleFactor: scale, locale: 'en-GB' })
    await context.addInitScript(KEEP_NAMES)
    await context.addInitScript(() => {
      localStorage.setItem('toBoldlyGlow.subtitles', 'on')
      localStorage.setItem('toBoldlyGlow.narrationSound', 'off')
      localStorage.setItem('toBoldlyGlow.music', 'off')
    })
    const page = await context.newPage()
    const totalBars = SCENES.reduce((sum, scene) => sum + scene.bars, 0) + END_BARS
    writeFileSync(path.join(tmp, 'music.wav'), await renderMusic(page, base, totalBars))
    const recording = await screencast(page, view.width * scale)
    await film(page, base, recording, format === 'portrait')
    await recording.end()
    const out = path.join(HERE, 'out', `to-boldly-glow-supercut-${format}.mp4`)
    mkdirSync(path.dirname(out), { recursive: true })
    const frames = writeFrames(tmp, recording)
    const audio = mixSoundtrack(tmp, path.join(HERE, 'voice'), totalBars * BAR)
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', frames, '-i', audio,
      '-vf', `scale=${view.width * scale}:${view.height * scale}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out,
    ])
    console.log(`\n  ${path.relative(process.cwd(), out)}`)
  } finally {
    await browser.close()
    await server.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

async function film(page: Page, base: string, recording: Recording, portrait: boolean): Promise<void> {
  for (const scene of SCENES) {
    await scene.prepare(page, base)
    await caption(page, scene.caption, { portrait, top: scene.captionOnTop ?? false })
    await page.mouse.move(2, 2)
    const seconds = scene.bars * BAR
    await recording.start(seconds)
    const started = Date.now()
    await scene.act(page, seconds)
    await wait(Math.max(0, seconds * 1000 - (Date.now() - started)))
    recording.stop()
    console.log(`  ${scene.caption}`)
  }
  await endCard(page, portrait)
  await recording.start(END_BARS * BAR)
  await wait(END_BARS * BAR * 1000 + 100)
  recording.stop()
}

// The frames Chrome paints, kept only while `on` is true.
async function screencast(page: Page, maxWidth: number): Promise<Recording> {
  const cdp = await page.context().newCDPSession(page)
  const recording: Recording = {
    on: false,
    frames: [],
    segments: [],
    start: async (seconds) => {
      recording.segments.push(seconds)
      recording.on = true
      // A still page paints no frame: a pixel that changes at each start makes Chrome paint one.
      await page.evaluate(() => {
        const pixel = document.getElementById('supercut-nudge') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'supercut-nudge' }))
        Object.assign(pixel.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', zIndex: '10001', pointerEvents: 'none' })
        pixel.style.background = pixel.style.background === 'rgba(0, 0, 0, 0.01)' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.01)'
      })
    },
    stop: () => (recording.on = false),
    end: () => cdp.send('Page.stopScreencast').catch(() => {}),
  }
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    if (recording.on) recording.frames.push({ t: metadata.timestamp ?? 0, data, segment: recording.segments.length - 1 })
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth, maxHeight: maxWidth * 2 })
  return recording
}

// The film frame by frame: each scene exactly its seconds × FPS frames, each frame the last one
// Chrome painted by then - counting frames rather than durations keeps every cut on its bar.
function writeFrames(tmp: string, recording: Recording): string {
  const dir = path.join(tmp, 'frames')
  mkdirSync(dir)
  let n = 0
  recording.segments.forEach((seconds, segment) => {
    const frames = recording.frames.filter((frame) => frame.segment === segment)
    if (!frames.length) throw new Error(`Scene ${segment + 1} painted nothing.`)
    let at = 0
    for (let k = 0; k < Math.round(seconds * FPS); k++) {
      while (at + 1 < frames.length && frames[at + 1].t - frames[0].t <= k / FPS) at++
      writeFileSync(path.join(dir, `${String(n++).padStart(5, '0')}.jpg`), Buffer.from(frames[at].data, 'base64'))
    }
  })
  return path.join(dir, '%05d.jpg')
}

await main()
