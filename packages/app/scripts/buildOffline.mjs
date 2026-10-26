// Builds the download that runs without a web server: unzip, open index.html, done.
//
// Opened from the disk (file://), a browser runs no module script from a file and fetches no file,
// and Chrome loads no font from one. So the code and its styles (fonts included) go inline into
// index.html; everything the app fetches - textures, the star catalog, the narration manifest, the
// engine's WebAssembly - goes into data/*.js, classic scripts the page loads first, and a small
// stand-in for fetch() serves them from there. The narration's audio stays as files: an <audio>
// element plays them from the disk. The app's own code is the same as online.
//
// Run `npm run build:offline` in packages/app: it writes dist-offline/to-boldly-glow-<version>/
// and dist-offline/to-boldly-glow-<version>.zip (needs `zip`).

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(path.join(APP, '../../package.json'), 'utf8'))
const NAME = `to-boldly-glow-${version}`
const OUT = path.join(APP, 'dist-offline')
const DIST = path.join(OUT, NAME)

// What the app fetches, by folder or file (relative to index.html); all else stays a plain file.
const FETCHED = [/^textures\//, /^sky\//, /^stars\//, /^narration\/manifest\.json$/, /^assets\/.*\.wasm$/]
const MIME = { woff2: 'font/woff2', woff: 'font/woff', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' }

// Runs before the data scripts: the table they fill, and fetch() answering from it for any URL
// inside the app's folder (others go to the network as usual).
const FETCH_STAND_IN = `
self.__tbgFiles = {};
(() => {
  const types = { jpg: 'image/jpeg', png: 'image/png', json: 'application/json', wasm: 'application/wasm' };
  const base = new URL('./', location.href).href;
  const networkFetch = self.fetch.bind(self);
  self.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href).href;
    const file = url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : null;
    const data = file && self.__tbgFiles[file];
    if (!data) return networkFetch(input, init);
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const type = types[file.split('.').pop()] || 'application/octet-stream';
    return Promise.resolve(new Response(bytes, { headers: { 'Content-Type': type } }));
  };
})();
`

rmSync(OUT, { recursive: true, force: true })
execFileSync('npx', ['vite', 'build', '--mode', 'offline', '--outDir', DIST, '--emptyOutDir'], { cwd: APP, stdio: 'inherit' })

const files = listFiles(DIST)
const fetched = files.filter((file) => FETCHED.some((pattern) => pattern.test(file)))
mkdirSync(path.join(DIST, 'data'))
const dataScripts = fetched.map((file) => {
  const script = `data/${file.replaceAll('/', '_')}.js`
  const base64 = readFileSync(path.join(DIST, file)).toString('base64')
  // The code asked for its assets relative to itself in assets/; inline, relative to the page.
  const asked = file.replace(/^assets\//, '')
  writeFileSync(path.join(DIST, script), `__tbgFiles[${JSON.stringify(asked)}]=${JSON.stringify(base64)}\n`)
  rmSync(path.join(DIST, file))
  return script
})
for (const dir of ['textures', 'sky', 'stars']) rmSync(path.join(DIST, dir), { recursive: true, force: true })

let html = readFileSync(path.join(DIST, 'index.html'), 'utf8')
html = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, '')
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/, (_, css) => `<style>${inlineUrls(read(css), path.dirname(css))}</style>`)
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/, (_, js) => {
  const loaders = [`<script>${FETCH_STAND_IN}</script>`, ...dataScripts.map((script) => `<script src="${script}"></script>`)]
  return `${loaders.join('\n')}\n<script type="module">${read(js).replaceAll('</script', '<\\/script')}</script>`
})
writeFileSync(path.join(DIST, 'index.html'), html)
// Inlined now: the code, the styles, the fonts (and the leftover of the engine's Node branch).
for (const file of listFiles(path.join(DIST, 'assets'))) rmSync(path.join(DIST, 'assets', file))
rmSync(path.join(DIST, 'assets'), { recursive: true })
writeFileSync(path.join(DIST, 'README.txt'), readFileSync(path.join(APP, 'scripts/offlineReadme.txt'), 'utf8').replaceAll('{version}', version))

execFileSync('zip', ['-qr', `${NAME}.zip`, NAME], { cwd: OUT, stdio: 'inherit' })
console.log(`Built ${path.relative(process.cwd(), path.join(OUT, `${NAME}.zip`))} (${(statSync(path.join(OUT, `${NAME}.zip`)).size / 1e6).toFixed(1)} MB)`)

function read(file) {
  return readFileSync(path.join(DIST, file), 'utf8')
}

// The stylesheet's url(...)s - fonts, images - as data: URLs.
function inlineUrls(css, dir) {
  return css.replace(/url\((['"]?)(?!data:)([^'")]+)\1\)/g, (match, _, url) => {
    const type = MIME[url.split('.').pop()]
    if (!type) return match
    return `url(data:${type};base64,${readFileSync(path.join(DIST, dir, url)).toString('base64')})`
  })
}

function listFiles(dir, prefix = '') {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full, `${prefix}${name}/`) : [`${prefix}${name}`]
  })
}
