import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CREDIT_GROUPS } from '../src/about/credits'

const APP = fileURLToPath(new URL('..', import.meta.url))
const PUBLIC = join(APP, 'public')
const REPO = join(APP, '..', '..')
const credits = CREDIT_GROUPS.flatMap((group) => group.credits)

// Built into the bundle without being a runtime dependency: the AssemblyScript runtime compiled into
// the engine's WebAssembly, and Rolldown's module runtime.
const BUILT_IN_TOOLS = ['assemblyscript', 'rolldown']

function runtimePackages(): string[] {
  const manifest = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  return [...Object.keys(manifest.dependencies).filter((name) => !name.startsWith('@toboldlyglow/')), ...BUILT_IN_TOOLS]
}

function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [relative(PUBLIC, path)]
  })
}

function installedLicense(pkg: string): string {
  const folder = join(REPO, 'node_modules', pkg)
  const file = readdirSync(folder).find((name) => /^licen[cs]e/i.test(name))
  if (!file) throw new Error(`${pkg} has no license file`)
  return readFileSync(join(folder, file), 'utf8')
}

describe('the licenses and thanks list', () => {
  it('has an entry for every package built into the app', () => {
    const credited = credits.map((credit) => credit.package)
    expect(runtimePackages().filter((pkg) => !credited.includes(pkg))).toEqual([])
  })

  it('covers every file the app ships from public/', () => {
    const covers = (file: string) => credits.some((credit) => credit.files?.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry)))
    expect(filesUnder(PUBLIC).filter((file) => !covers(file))).toEqual([])
  })

  it('ships every license text it links to', () => {
    const shipped = credits.flatMap((credit) => (credit.text && !credit.text.startsWith('https://') ? [credit.text] : []))
    expect(shipped.filter((text) => !existsSync(join(PUBLIC, text)))).toEqual([])
  })

  it('ships each package’s license text as the installed version has it', () => {
    for (const credit of credits.filter((entry) => entry.package)) {
      const shipped = readFileSync(join(PUBLIC, credit.text ?? ''), 'utf8')
      expect(shipped, credit.name).toContain(installedLicense(credit.package ?? '').trim())
    }
  })

  it('ships the project’s own license as the repository has it', () => {
    expect(readFileSync(join(PUBLIC, 'licenses/to-boldly-glow.txt'), 'utf8')).toBe(readFileSync(join(REPO, 'LICENSE'), 'utf8'))
  })

  it('names a license and a website for every entry', () => {
    expect(credits.filter((credit) => !credit.license || !credit.home.startsWith('https://'))).toEqual([])
  })
})
