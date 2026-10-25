import { CREDIT_GROUPS, type Credit, type CreditGroup } from './credits'
import { msg } from '../i18n/i18n'

// The About dialog behind the top right info button: who makes the app, where it lives, what (not)
// leaves the browser, its license, and the licenses and thanks for everything it ships. A native
// modal <dialog>: it keeps the focus inside, Escape closes it, and focus returns to the opener.
export class AboutDialog {
  constructor(
    private readonly dialog: HTMLDialogElement,
    elements: { openButton: HTMLButtonElement; closeButton: HTMLButtonElement; credits: HTMLElement },
  ) {
    elements.credits.replaceChildren(...CREDIT_GROUPS.map(renderGroup))
    elements.openButton.addEventListener('click', () => this.open())
    elements.closeButton.addEventListener('click', () => dialog.close())
    // A press on the backdrop (outside the dialog's box) closes it too.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && !insideBox(dialog, event)) dialog.close()
    })
  }

  open(): void {
    if (!this.dialog.open) this.dialog.showModal()
  }
}

function insideBox(element: HTMLElement, event: MouseEvent): boolean {
  const box = element.getBoundingClientRect()
  return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
}

function renderGroup(group: CreditGroup): HTMLElement {
  const section = document.createElement('section')
  const title = Object.assign(document.createElement('h3'), { className: 'hud-group-title', textContent: group.title })
  const list = Object.assign(document.createElement('ul'), { className: 'hud-credits' })
  list.append(...group.credits.map(renderCredit))
  section.append(title, list)
  return section
}

function renderCredit(credit: Credit): HTMLElement {
  const item = document.createElement('li')
  const name = Object.assign(document.createElement('span'), { className: 'hud-credit-name', textContent: credit.name })
  const use = Object.assign(document.createElement('span'), { className: 'hud-credit-use', textContent: credit.use })
  item.append(name, use)
  if (credit.changes) item.append(Object.assign(document.createElement('span'), { className: 'hud-credit-use', textContent: msg.ui.about.changes(credit.changes) }))
  const meta = Object.assign(document.createElement('span'), { className: 'hud-credit-meta' })
  meta.append(Object.assign(document.createElement('span'), { textContent: credit.license }), link(msg.ui.about.website, credit.home))
  if (credit.text) meta.append(link(msg.ui.about.licenseLink, credit.text))
  item.append(meta)
  return item
}

function link(label: string, href: string): HTMLAnchorElement {
  return Object.assign(document.createElement('a'), { href, textContent: label, target: '_blank', rel: 'noopener' })
}
