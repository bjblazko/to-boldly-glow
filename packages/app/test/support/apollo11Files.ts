import { readFileSync } from 'node:fs'
import { apollo11Trajectory, type Apollo11Trajectory } from '../../src/missions/apollo11/apollo11Trajectory'

// The real trajectory files from public/data/apollo11, for tests.
export function realApollo11Trajectory(): Apollo11Trajectory {
  const file = (name: string) => {
    const bytes = readFileSync(new URL(`../../public/data/apollo11/${name}.bin`, import.meta.url))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  return apollo11Trajectory({ translunar: file('translunar'), lunar: file('lunar'), eagle: file('eagle'), transearth: file('transearth'), moon: file('moon') })
}
