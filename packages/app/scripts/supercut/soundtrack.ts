import type { Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

// Nova's tempo: every cut of the film falls on one of its bars.
export const BPM = 112
export const BAR = (4 * 60) / BPM
const SAMPLE_RATE = 48_000
// tsx keeps function names with a helper of its own, which the functions it hands to the page call.
export const KEEP_NAMES = 'globalThis.__name ??= (fn) => fn'
// Served by the dev server to the page (as URLs, so TypeScript leaves them to the browser).
const MUSIC_ENGINE = '/src/music/musicEngine.ts'
const MUSIC_TRACKS = '/src/music/musicTracks.ts'
// Where Lyra speaks, in bars from the start (see lines.json).
const LINES: [id: string, bar: number][] = [
  ['intro', 0.25],
  ['middle', 8],
  ['outro', 16.1],
]

// Nova, played by the app's own synthesizer into an OfflineAudioContext: `bars` bars from the
// top, as a 16-bit stereo WAV.
export async function renderMusic(page: Page, base: string, bars: number): Promise<Buffer> {
  await page.goto(`${base}/?tour=off`)
  await page.evaluate(KEEP_NAMES)
  const base64 = await page.evaluate(
    async ([bars, rate, engineUrl, tracksUrl]) => {
      const { Performance } = (await import(engineUrl)) as typeof import('../../src/music/musicEngine')
      const { MUSIC_TRACKS } = (await import(tracksUrl)) as typeof import('../../src/music/musicTracks')
      const track = MUSIC_TRACKS.nova
      const seconds = (bars * 240) / track.bpm
      const ctx = new OfflineAudioContext(2, Math.ceil((seconds + 3) * rate), rate)
      const performance = new Performance(ctx, ctx.destination, track, 0)
      performance.scheduleThrough(seconds)
      performance.halt()
      const buffer = await ctx.startRendering()
      return wav(buffer)

      function wav(buffer: AudioBuffer): string {
        const [left, right] = [buffer.getChannelData(0), buffer.getChannelData(1)]
        const view = new DataView(new ArrayBuffer(44 + left.length * 4))
        const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)))
        text(0, 'RIFF'); view.setUint32(4, 36 + left.length * 4, true); text(8, 'WAVEfmt ')
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
        view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 4, true)
        view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, left.length * 4, true)
        for (let i = 0; i < left.length; i++) {
          view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 32767, true)
          view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i])) * 32767, true)
        }
        let binary = ''
        const bytes = new Uint8Array(view.buffer)
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return btoa(binary)
      }
    },
    [bars, SAMPLE_RATE, MUSIC_ENGINE, MUSIC_TRACKS] as const,
  )
  return Buffer.from(base64, 'base64')
}

// The music with Lyra's lines laid over it at their bars, the music stepping back under her voice,
// the music faded out at the end - as tmp/soundtrack.wav.
export function mixSoundtrack(tmp: string, voiceDir: string, seconds: number): string {
  const out = path.join(tmp, 'soundtrack.wav')
  const inputs = LINES.flatMap(([id]) => ['-i', path.join(voiceDir, `${id}.wav`)])
  const delays = LINES.map(([, bar], i) => `[${i + 1}]adelay=${Math.round(bar * BAR * 1000)}:all=1[v${i}]`)
  const voices = LINES.map((_, i) => `[v${i}]`).join('')
  const filter = [
    // The synthesizer starts its first bar 0.1 s in.
    '[0]atrim=start=0.1,asetpts=PTS-STARTPTS,volume=1.4[music]',
    ...delays,
    // Padded with silence to the end: the compressor stops where its key does.
    `${voices}amix=inputs=${LINES.length}:normalize=0,aformat=channel_layouts=stereo,apad=whole_dur=${seconds.toFixed(2)},asplit[key][voice]`,
    `[music][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500,afade=t=out:st=${(seconds - 2).toFixed(2)}:d=2[ducked]`,
    `[ducked][voice]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false,atrim=0:${seconds.toFixed(2)}[mix]`,
  ].join(';')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'music.wav'), ...inputs, '-filter_complex', filter, '-map', '[mix]', '-ar', String(SAMPLE_RATE), out])
  return out
}
