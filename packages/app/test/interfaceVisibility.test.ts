import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const button = () => ({ hidden: true, focus: () => {}, addEventListener: () => {} }) as unknown as HTMLButtonElement

describe('hiding the interface', () => {
  beforeAll(() => {
    ;(globalThis as { window?: unknown }).window ??= { addEventListener: () => {} }
  })

  it('works in a lesson too, not only in Explore', async () => {
    const { InterfaceVisibility } = await import('../src/hud/interfaceVisibility')
    const body = { dataset: { appMode: 'learn' } } as unknown as HTMLElement
    const ui = new InterfaceVisibility(body, { hide: button(), show: button(), returnFocus: button() })
    ui.hide()
    expect(ui.isHidden).toBe(true)
    ui.show()
    expect(ui.isHidden).toBe(false)
  })

  it('hides the lesson’s panel and the mission card with the rest, and offers the button in a lesson', () => {
    const css = readFileSync(new URL('../src/hud/hud.css', import.meta.url), 'utf8')
    const rule = css.match(/body\[data-ui-hidden\] :is\(([^)]*)\)/)![1]
    expect(rule).toContain('.hud-lesson-panel')
    expect(rule).toContain('.hud-mission')
    expect(css).not.toContain("body[data-app-mode='learn'] #hide-ui-btn")
  })
})
