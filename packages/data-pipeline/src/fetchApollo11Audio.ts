import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { APOLLO11_CLIPS, type OriginalClip } from './apollo/originalAudio'

// Fetches NASA's recordings (apollo/originalAudio.ts) into the cache, cuts each clip, evens its
// loudness as the narration's is (-16 LUFS) and encodes it as the narration is (Opus WebM, MP3) into
// the app, with the clips' lengths for the lesson. `npm run fetch-apollo11-audio`; the output is
// committed, the sources are not.

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '../cache/apollo11-audio')
const OUT = join(HERE, '../../app/public/audio/apollo11')
const LENGTHS = join(HERE, '../../app/src/learn/lessons/apollo11Audio.json')
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'
const FFPROBE = FFMPEG.replace(/ffmpeg$/, 'ffprobe')

// Each source in a directory of its own (downloads are untrusted data); fetched once.
async function cached(url: string): Promise<string> {
  const directory = join(CACHE, basename(url).replace(/\.[^.]+$/, ''))
  const file = join(directory, basename(url))
  if (existsSync(file)) return file
  mkdirSync(directory, { recursive: true })
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`${url}: ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${file}.part`))
  renameSync(`${file}.part`, file)
  return file
}

function cut(source: string, clip: OriginalClip): number {
  const target = join(OUT, clip.chapter)
  const range = ['-ss', String(clip.from), ...(clip.to === null ? [] : ['-to', String(clip.to)])]
  const filter = 'afade=t=in:d=0.05,areverse,afade=t=in:d=0.15,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[opus][mp3]'
  execFileSync(FFMPEG, [
    '-loglevel', 'error', '-y', ...range, '-i', source, '-filter_complex', filter, '-map_metadata', '-1',
    '-map', '[opus]', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', `${target}.webm`,
    '-map', '[mp3]', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', `${target}.mp3`,
  ])
  const seconds = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${target}.mp3`]).toString()
  return Math.round(Number(seconds) * 100) / 100
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true })
  const lengths: Record<string, number> = {}
  for (const clip of APOLLO11_CLIPS) {
    lengths[clip.chapter] = cut(await cached(clip.source), clip)
    console.log(`${clip.chapter}: ${lengths[clip.chapter]} s`)
  }
  writeFileSync(LENGTHS, `${JSON.stringify(lengths, null, 2)}\n`)
}
