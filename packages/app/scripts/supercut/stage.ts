import type { Page } from '@playwright/test'

// The supercut's stagecraft: booting the app the same way for every scene, captions, and camera
// moves in real time (the e2e helpers step a frozen test clock instead).

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A fresh app: English, no welcome card, no idle tour, the narrator's subtitles on.
export async function boot(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/?tour=off&lang=en`)
  await page.locator('#scene[data-rendered="true"]').waitFor({ timeout: 60_000 })
  await page.addStyleTag({ content: '.hud-beta-note, .hud-camera-hint { display: none !important; }' })
  await wait(1500)
}

export async function followBody(page: Page, name: string): Promise<void> {
  await page.locator('.hud-dock-btn[data-panel="find"]:visible').click()
  await page.locator('#entity-search-input').fill(name)
  await page.locator('#entity-search-input').press('Enter')
  await page.locator('.hud-dock-btn[data-panel="find"]:visible').click()
  await wait(3500)
}

// The scene alone: no interface, no beta note.
export async function sceneOnly(page: Page): Promise<void> {
  await page.keyboard.press('h')
  await page.addStyleTag({ content: '#show-ui-btn { display: none !important; }' })
}

export async function setSwitch(page: Page, selector: string, on: boolean): Promise<void> {
  const opener = page.locator('.hud-dock-btn[data-panel="view"]:visible')
  await opener.click()
  await page.locator(selector).setChecked(on, { force: true })
  await opener.click()
}

// Drags the orbit camera from the center by (dx, dy) over `ms`, then holds still before letting
// go, so it stops where the drag ends.
export async function drag(page: Page, [dx, dy]: [number, number], ms = 300): Promise<void> {
  const { width, height } = page.viewportSize()!
  const [x, y] = [width / 2, height / 2]
  const steps = Math.max(2, Math.round(ms / 33))
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps)
    await wait(ms / steps)
  }
  await wait(120)
  await page.mouse.up()
  await wait(250)
}

// Zooms the orbit camera in (negative) or out (positive) with the mouse wheel, at the center.
export async function zoom(page: Page, notches: number): Promise<void> {
  const { width, height } = page.viewportSize()!
  await page.mouse.move(width / 2, height / 2)
  for (let i = 0; i < Math.abs(notches); i++) {
    await page.mouse.wheel(0, Math.sign(notches) * 100)
    await wait(60)
  }
  await wait(1200)
}

// A caption at the foot of the frame, in the app's own type.
export async function caption(page: Page, text: string, { portrait, top }: { portrait: boolean; top: boolean }): Promise<void> {
  await page.evaluate(
    ([text, portrait, top]) => {
      document.getElementById('supercut-caption')?.remove()
      const element = Object.assign(document.createElement('div'), { id: 'supercut-caption', textContent: text })
      Object.assign(element.style, {
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: '9999',
        ...(top ? { top: portrait ? '16%' : '15%' } : { bottom: portrait ? '30%' : '9%' }),
        maxWidth: '86vw', textAlign: 'center', textWrap: 'balance', color: '#f4f5fa', background: 'rgba(0, 0, 0, 0.55)',
        font: `600 ${portrait ? 26 : 30}px/1.3 var(--hud-font)`, padding: '10px 20px', pointerEvents: 'none',
      })
      document.body.append(element)
    },
    [text, portrait, top] as const,
  )
}

export async function endCard(page: Page, portrait: boolean): Promise<void> {
  await page.evaluate((portrait) => {
    document.getElementById('supercut-caption')?.remove()
    const card = document.createElement('div')
    Object.assign(card.style, {
      position: 'fixed', inset: '0', zIndex: '10000', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '18px', background: 'radial-gradient(circle at 50% 45%, #1b1440, #05060d 70%)',
      color: '#f4f5fa', fontFamily: 'var(--hud-font)', textAlign: 'center',
    })
    card.innerHTML = `<img src="logo.svg" alt="" style="width:${portrait ? 120 : 110}px;height:auto">
      <div style="font-size:${portrait ? 46 : 54}px;font-weight:700;letter-spacing:-0.01em">To Boldly Glow</div>
      <div style="font-size:${portrait ? 22 : 24}px;color:#b8bccc;max-width:80vw">The Solar System, live in your browser. Free and open source.</div>
      <div style="font:500 ${portrait ? 20 : 24}px var(--hud-mono);margin-top:6px">huepattl.de/products/to-boldly-glow</div>`
    document.body.append(card)
  }, portrait)
  await wait(400)
}

// Turns the orbit camera until the Sun lies right behind the followed body, so the body eclipses
// it and the corona shows. Labels must be on: the Sun's label says where it is. Each round
// measures how the Sun moves per pixel of drag and drags by what should center it.
export async function sunBehindTarget(page: Page): Promise<void> {
  const { width, height } = page.viewportSize()!
  const center = { x: width / 2, y: height / 2 }
  for (let round = 0; round < 10; round++) {
    const start = await sunOnScreen(page)
    if (!start) {
      await bringSunIntoView(page)
      continue
    }
    if (Math.hypot(center.x - start.x, center.y - start.y) < 1) return
    await drag(page, [25, 0])
    const afterX = await sunOnScreen(page)
    await drag(page, [0, 25])
    const afterY = await sunOnScreen(page)
    if (!afterX || !afterY) continue
    const [a, b, c, d] = [(afterX.x - start.x) / 25, (afterY.x - afterX.x) / 25, (afterX.y - start.y) / 25, (afterY.y - afterX.y) / 25]
    const [ex, ey] = [center.x - afterY.x, center.y - afterY.y]
    const determinant = a * d - b * c
    await drag(page, [(d * ex - b * ey) / determinant + 40, (-c * ex + a * ey) / determinant + 40])
    await drag(page, [-40, -40])
  }
}

// Sweeps the orbit camera around its target until the Sun comes into view.
async function bringSunIntoView(page: Page): Promise<void> {
  for (const dy of [-120, -120, 360, 120]) {
    await drag(page, [0, dy])
    for (let i = 0; i < 6; i++) {
      if (await sunOnScreen(page)) return
      await drag(page, [160, 0])
    }
  }
}

async function sunOnScreen(page: Page): Promise<{ x: number; y: number } | null> {
  return page.locator('#body-labels .body-label:text-is("Sun")').evaluate((label: HTMLElement) =>
    label.hidden ? null : { x: parseFloat(label.style.left), y: parseFloat(label.style.top) },
  )
}
