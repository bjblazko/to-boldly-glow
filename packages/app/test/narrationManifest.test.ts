import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { NarrationManifest } from '../src/narration/narrationManifest'
import { narrationSegments } from '../src/narration/narrationSegments'
import { NARRATOR_VOICES } from '../src/narration/narratorVoice'

const PUBLIC = join(__dirname, '..', 'public')
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'narration', 'manifest.json'), 'utf8')) as NarrationManifest

// As synthesize.py's clip_hash: a changed text, voice reference, model or encoding makes a clip stale.
function clipHash(voice: string, reference: string | undefined, text: string): string {
  return createHash('sha256').update(`${manifest.model}\n${manifest.encoding}\n${voice}\n${reference}\n${text}`).digest('hex').slice(0, 16)
}

describe('the narration audio', () => {
  it.each(NARRATOR_VOICES)('has an up-to-date clip in %s’s voice for every narration text (else: npm run narrate in packages/data-pipeline)', (voice) => {
    const clips = manifest.voices[voice]
    const stale = narrationSegments()
      .filter(({ locale, id, text }) => clips?.clips[locale]?.[id]?.hash !== clipHash(voice, clips?.references[locale], text) || ['webm', 'mp3'].some((extension) => !existsSync(join(PUBLIC, 'narration', voice, locale, `${id}.${extension}`))))
      .map(({ locale, id }) => `${locale}/${id}`)
    expect(stale).toEqual([])
  })

  it('knows every clip’s length', () => {
    for (const voice of Object.values(manifest.voices)) for (const clips of Object.values(voice.clips)) for (const { seconds } of Object.values(clips)) expect(seconds).toBeGreaterThan(1)
  })
})
