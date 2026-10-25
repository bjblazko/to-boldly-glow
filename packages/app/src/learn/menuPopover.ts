// A list that opens above its dock button and closes again on the button, on Escape and on a press
// anywhere outside it. Opening it focuses its current entry.
export class MenuPopover {
  constructor(
    private readonly menu: HTMLElement,
    private readonly button: HTMLButtonElement,
  ) {
    button.addEventListener('click', () => this.setOpen(Boolean(this.menu.hidden)))
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.menu.hidden) this.setOpen(false)
    })
    window.addEventListener('pointerdown', (event) => {
      const target = event.target as Node | null
      if (this.menu.hidden || this.menu.contains(target) || this.button.contains(target)) return
      this.setOpen(false)
    })
  }

  setOpen(open: boolean): void {
    this.menu.hidden = !open
    this.button.setAttribute('aria-expanded', String(open))
    this.button.classList.toggle('is-active', open)
    if (open) this.menu.querySelector<HTMLElement>('[aria-current] button, button[aria-pressed="true"]')?.focus()
  }
}
