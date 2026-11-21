// Where the source code of this very version lives: its release tag in the repository. The app is
// GPL-3.0-or-later, so whoever gets it can get the source it was built from (section 6).
export const REPOSITORY = 'https://github.com/bjblazko/to-boldly-glow'

export function sourceUrl(version: string): string {
  return `${REPOSITORY}/tree/v${version}`
}
