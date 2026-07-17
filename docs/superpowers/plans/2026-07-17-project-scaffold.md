# Project Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the npm workspace, the AssemblyScript→WASM build pipeline for the engine
package, and a minimal Vite app that calls into it — proven end-to-end with real (not throwaway)
functionality: Julian Date conversion — plus CI, so every subsequent phase builds on a working,
tested foundation.

**Architecture:** Three npm workspace packages per the MVP spec (§3.1): `packages/engine`
(AssemblyScript, compiled to WASM via `asc`'s `--bindings esm` output so it's importable as a
plain ESM module — no hand-rolled WASM instantiation code, no third-party Vite/AssemblyScript
plugin), `packages/app` (Vite + TypeScript, imports the engine package directly), and
`packages/data-pipeline` (not created in this phase — YAGNI until the star-catalog work needs it).

**Tech Stack:** Node.js 20, npm workspaces, TypeScript (strict), AssemblyScript (`asc`), Vite,
Vitest (unit), Playwright (integration/E2E), ESLint (flat config), GitHub Actions.

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md`; every task
below implicitly inherits these.)

- Renderer: WebGPU only, no WebGL2 fallback (spec §3.2). Not exercised yet in this phase — no
  rendering code exists until a later plan — but no code in this plan may introduce a WebGL
  dependency.
- Repository layout: npm workspaces with `packages/engine`, `packages/app`, `packages/data-pipeline`
  (spec §3.1).
- UI layer: plain TypeScript + DOM, no framework (decided during brainstorming; spec §4.7 "no
  state-management framework or library").
- Code license: MIT (`LICENSE`, already committed).
- Testing: Vitest for unit tests, Playwright for integration tests (spec §7).
- Changelog: Keep a Changelog format in `CHANGELOG.md` (already scaffolded).
- No runtime network fetch for MVP core data — everything bundled/computed locally (spec §5).

---

### Task 1: Root Workspace & Tooling

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.nvmrc`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: root `npm install`, `npm run lint`, `npm run build`, `npm run test`, `npm run test:e2e`
  script entry points that later tasks wire real workspace scripts into. `tsconfig.base.json` is
  extended by every package's own `tsconfig.json`.

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "to-boldly-glow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "npm run build --workspace=@toboldlyglow/engine && npm run build --workspace=@toboldlyglow/app",
    "test": "npm run test --workspace=@toboldlyglow/engine",
    "test:e2e": "npm run build && npm run test:e2e --workspace=@toboldlyglow/app",
    "lint": "eslint ."
  },
  "devDependencies": {
    "eslint": "^9.10.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.5.0"
  }
}
```

- [ ] **Step 4: Create `eslint.config.js`**

```js
// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**'],
  },
  ...tseslint.configs.recommended,
)
```

- [ ] **Step 5: Install and verify**

Run: `npm install`
Expected: completes with no errors (no workspace packages exist yet, so this just installs root
devDependencies).

Run: `npm run lint`
Expected: exits 0 (no source files yet to lint).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json eslint.config.js .nvmrc
git commit -m "chore: scaffold root npm workspace and tooling"
```

---

### Task 2: Engine Package — AssemblyScript Build Pipeline

**Files:**
- Create: `packages/engine/package.json`
- Create: `packages/engine/asconfig.json`
- Create: `packages/engine/assembly/index.ts`
- Create: `packages/engine/vitest.config.ts`
- Test: `packages/engine/test/ping.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1).
- Produces: `packages/engine` builds to `build/engine.wasm` + `build/engine.js` (ESM wrapper) +
  `build/engine.d.ts` via `npm run build --workspace=@toboldlyglow/engine`. Exports
  `export function ping(): i32` — later tasks/plans re-export additional functions from the same
  `assembly/index.ts` entry point. Downstream packages import from `@toboldlyglow/engine`
  (resolved by npm workspaces to `packages/engine`, whose `package.json` `main`/`types` point at
  `./build/engine.js` / `./build/engine.d.ts`).

- [ ] **Step 1: Create `packages/engine/assembly/index.ts`**

```typescript
export function ping(): i32 {
  return 42
}
```

- [ ] **Step 2: Create `packages/engine/asconfig.json`**

```json
{
  "entries": ["assembly/index.ts"],
  "targets": {
    "release": {
      "outFile": "build/engine.wasm",
      "bindings": "esm",
      "optimize": true
    }
  }
}
```

(The top-level `entries` array is required — `asc` only treats a compile as having work to do if
an entry file is given either as a positional CLI argument or via this `entries` array; the
`targets.<name>` block alone only supplies compile options like `outFile`/`bindings`, not entry
files. Without `entries`, `npm run build` silently prints help text and exits 0 with no output.)

- [ ] **Step 3: Create `packages/engine/package.json`**

```json
{
  "name": "@toboldlyglow/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./build/engine.js",
  "types": "./build/engine.d.ts",
  "scripts": {
    "build": "asc --config asconfig.json --target release",
    "test": "npm run build && vitest run"
  },
  "devDependencies": {
    "assemblyscript": "^0.27.29",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Create `packages/engine/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Install and build**

Run: `npm install` (from repo root)
Expected: installs `assemblyscript` and `vitest` into `packages/engine`.

Run: `npm run build --workspace=@toboldlyglow/engine`
Expected: creates `packages/engine/build/engine.wasm`, `build/engine.js`, `build/engine.d.ts` with
no compiler errors.

- [ ] **Step 6: Write the smoke test**

`packages/engine/test/ping.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { ping } from '../build/engine.js'

describe('WASM build pipeline', () => {
  it('loads the compiled module and calls an exported function', () => {
    expect(ping()).toBe(42)
  })
})
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: PASS — 1 test passed. (If the generated `engine.js` bindings fail to load the `.wasm`
file under Node, the error will point at the instantiation step; AssemblyScript's `esm` bindings
target supports both Node and browser environments, so this should work as-is. If it doesn't,
resolve the loader issue here before moving on — every later task depends on this working.)

- [ ] **Step 8: Commit**

```bash
git add packages/engine/package.json packages/engine/asconfig.json packages/engine/assembly/index.ts packages/engine/vitest.config.ts packages/engine/test/ping.test.ts
git commit -m "feat(engine): scaffold AssemblyScript build pipeline with a smoke test"
```

(Note: `packages/engine/build/` is git-ignored per the root `.gitignore`'s `build/` entry — only
source and config are committed.)

---

### Task 3: Engine Package — Julian Date Utilities

**Files:**
- Create: `packages/engine/assembly/time.ts`
- Modify: `packages/engine/assembly/index.ts`
- Test: `packages/engine/test/time.test.ts`

**Interfaces:**
- Consumes: the build pipeline from Task 2.
- Produces: `calendarToJulianDay(year: i32, month: i32, day: f64): f64` and
  `daysSinceJ2000(julianDay: f64): f64`, exported from `@toboldlyglow/engine`. Later plans (orbital
  position algorithms) will consume `daysSinceJ2000` as the time input to Keplerian/VSOP87
  evaluation.

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/time.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { calendarToJulianDay, daysSinceJ2000 } from '../build/engine.js'

describe('calendarToJulianDay', () => {
  it('matches the J2000.0 epoch (2000-01-01 12:00 UTC = JD 2451545.0)', () => {
    expect(calendarToJulianDay(2000, 1, 1.5)).toBeCloseTo(2451545.0, 6)
  })

  it('matches the Unix epoch (1970-01-01 00:00 UTC = JD 2440587.5)', () => {
    expect(calendarToJulianDay(1970, 1, 1.0)).toBeCloseTo(2440587.5, 6)
  })

  it('matches the Modified Julian Date epoch (1858-11-17 00:00 UTC = JD 2400000.5)', () => {
    expect(calendarToJulianDay(1858, 11, 17.0)).toBeCloseTo(2400000.5, 6)
  })
})

describe('daysSinceJ2000', () => {
  it('is zero at the J2000.0 epoch', () => {
    expect(daysSinceJ2000(2451545.0)).toBeCloseTo(0, 6)
  })

  it('is negative before J2000.0', () => {
    expect(daysSinceJ2000(2440587.5)).toBeCloseTo(2440587.5 - 2451545.0, 6)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: FAIL — `calendarToJulianDay` and `daysSinceJ2000` are not exported from `../build/engine.js`.

- [ ] **Step 3: Implement `packages/engine/assembly/time.ts`**

```typescript
// Julian Day algorithm (Gregorian calendar), per Jean Meeus, "Astronomical Algorithms", ch. 7.
export function calendarToJulianDay(year: i32, month: i32, day: f64): f64 {
  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const a = Math.floor(f64(y) / 100.0)
  const b = 2.0 - a + Math.floor(a / 4.0)
  return (
    Math.floor(365.25 * f64(y + 4716)) +
    Math.floor(30.6001 * f64(m + 1)) +
    day +
    b -
    1524.5
  )
}

export function daysSinceJ2000(julianDay: f64): f64 {
  return julianDay - 2451545.0
}
```

- [ ] **Step 4: Re-export from `packages/engine/assembly/index.ts`**

```typescript
export { calendarToJulianDay, daysSinceJ2000 } from './time'

export function ping(): i32 {
  return 42
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@toboldlyglow/engine`
Expected: PASS — all 6 tests pass (1 from Task 2, 5 new).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/assembly/time.ts packages/engine/assembly/index.ts packages/engine/test/time.test.ts
git commit -m "feat(engine): add Julian Date conversion utilities"
```

---

### Task 4: App Package — Vite Scaffold & Engine Integration

**Files:**
- Create: `packages/app/package.json`
- Create: `packages/app/tsconfig.json`
- Create: `packages/app/vite.config.ts`
- Create: `packages/app/index.html`
- Create: `packages/app/src/main.ts`
- Create: `packages/app/playwright.config.ts`
- Test: `packages/app/e2e/scaffold.spec.ts`

**Interfaces:**
- Consumes: `@toboldlyglow/engine`'s `calendarToJulianDay` (Task 3), `tsconfig.base.json` (Task 1).
- Produces: a running Vite dev server (`npm run dev --workspace=@toboldlyglow/app`) rendering a
  page whose `#app` element later tasks/plans replace with the real WebGPU canvas and HUD; the
  Playwright config (`baseURL`, `webServer`) that later E2E specs (popups, time control, language
  switcher, About dialog — spec §7) will be added alongside.

- [ ] **Step 1: Create `packages/app/package.json`**

```json
{
  "name": "@toboldlyglow/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@toboldlyglow/engine": "*"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/app/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/app/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    target: 'esnext',
  },
})
```

(The `build.target: 'esnext'` is required because `packages/engine`'s AssemblyScript `--bindings
esm` output uses a top-level `await` to instantiate the WASM module — Vite's default production
build target doesn't support top-level await during bundling/minification. Vite's dev server serves
native ESM and isn't affected, so a dev-server-only check won't catch this; verify with an actual
`vite build`, not just `npm run dev`.)

- [ ] **Step 4: Create `packages/app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>To Boldly Glow</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `packages/app/src/main.ts`**

```typescript
import { calendarToJulianDay } from '@toboldlyglow/engine'

const jd = calendarToJulianDay(2000, 1, 1.5)
const appDiv = document.querySelector<HTMLDivElement>('#app')
if (appDiv) {
  appDiv.textContent = `Engine loaded. Julian Day for 2000-01-01 12:00 UTC: ${jd}`
}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install` (from repo root)
Expected: installs Vite/Playwright into `packages/app`, links `@toboldlyglow/engine` as a workspace
dependency.

- [ ] **Step 7: Manually verify the dev server**

Run: `npm run dev --workspace=@toboldlyglow/app`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`); opening it shows the text
"Engine loaded. Julian Day for 2000-01-01 12:00 UTC: 2451545". Stop the server (Ctrl+C) once
confirmed.

- [ ] **Step 7b: Verify the production build too**

Run: `npm run build --workspace=@toboldlyglow/app`
Expected: exits 0 and produces `packages/app/dist/`. The dev server (Step 7) serves native ESM and
will succeed even without `build.target: 'esnext'` in `vite.config.ts`; only a real production
build exercises Vite's bundling/minification path, which is what needs that setting because of the
engine module's top-level await. Don't skip this step just because the dev server worked.

- [ ] **Step 8: Create `packages/app/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
})
```

- [ ] **Step 9: Write the failing E2E test**

`packages/app/e2e/scaffold.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

test('app boots and the engine module computes the expected Julian Day', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#app')).toContainText('2451545')
})
```

- [ ] **Step 10: Install Playwright browsers and run the E2E test**

Run: `npx playwright install --with-deps chromium` (one-time setup)
Run: `npm run test:e2e --workspace=@toboldlyglow/app`
Expected: PASS — 1 test passed (Playwright starts the dev server automatically per
`webServer` config).

- [ ] **Step 11: Commit**

```bash
git add packages/app/package.json packages/app/tsconfig.json packages/app/vite.config.ts packages/app/index.html packages/app/src/main.ts packages/app/playwright.config.ts packages/app/e2e/scaffold.spec.ts
git commit -m "feat(app): scaffold Vite app wired to the engine package"
```

---

### Task 5: Continuous Integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint`, `npm run build`, `npm run test`, `npm run test:e2e` (root scripts,
  Task 1, wired to real workspace scripts by Tasks 2–4).
- Produces: a GitHub Actions status check on every push/PR to `main`, which later plans' tasks
  extend by adding more unit/E2E specs — no workflow changes needed as the test suites grow.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Verify the same commands succeed locally**

Run, from the repo root: `npm ci && npm run lint && npm run build && npm test`
Expected: all four commands exit 0, matching what CI will run (there is no GitHub remote yet, so
this local run is the verification until the repo is pushed).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run lint, build, and both test suites on push/PR"
```

---

## Verification (whole plan)

After all 5 tasks: `npm ci && npm run lint && npm run build && npm test && npm run test:e2e`
run from the repo root should all pass with zero manual intervention, and `npm run dev --workspace=@toboldlyglow/app`
should show the Julian Day text in a browser. `git log --oneline` should show 5 commits since the
design-spec commit (`81d06ec`), one per task.

## What's next

This plan only covers foundational infrastructure — a small slice of the MVP spec's §3
(Architecture) and the beginning of §7 (Testing & CI). It intentionally does not touch orbital
position algorithms, the WebGPU renderer, camera/time controllers, the scale toggle, star/
constellation data, popups/HUD/About dialog, i18n content, or the PWA shell. Each of those becomes
its own plan (via writing-plans again) once this scaffold is working, in roughly this order:

1. Orbital mechanics (Julian Date is already done here; add planetary/lunar position algorithms
   and coordinate transforms — needs care sourcing accurate reference coefficients, so treat as its
   own research-backed plan rather than reusing this one's velocity)
2. WebGPU renderer core (device/adapter setup, floating-origin camera-relative rendering, textured
   spheres for Sun/planets/moons)
3. Camera controller (desktop + touch input, FOV, presets)
4. Time controller (play/pause, jog/shuttle, presets, reverse)
5. Scale toggle (realistic ⇄ explorer slider)
6. Data pipeline + star field/constellation rendering
7. UI layer (popups, HUD, About/Credits dialog, EN/DE i18n)
8. PWA/offline (service worker, manifest)
