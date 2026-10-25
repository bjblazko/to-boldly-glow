import { locale } from '../i18n/i18n'
import { LOCALE_NAMES, rememberLocale, SUPPORTED_LOCALES, type Locale } from '../i18n/locale'

// The Settings panel's language buttons, one per language in its own name. Picking another one
// remembers it and reloads the page in it (every text is settled as the page loads - see i18n.ts).
export function bindLanguageSwitch(container: HTMLElement): void {
  container.replaceChildren(...SUPPORTED_LOCALES.map(languageButton))
}

function languageButton(target: Locale): HTMLButtonElement {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-segmented-btn', textContent: LOCALE_NAMES[target] })
  button.lang = target
  button.setAttribute('aria-pressed', String(target === locale))
  button.addEventListener('click', () => switchLocale(target))
  return button
}

export function switchLocale(target: Locale): void {
  rememberLocale(target)
  if (target === locale) return
  // A ?lang= in the address would win over the choice: drop it.
  const url = new URL(window.location.href)
  url.searchParams.delete('lang')
  window.location.replace(url)
}
