import './controlsHelp.css'
import { msg } from '../i18n/i18n'

// The About dialog's "Controls": for each situation (orbiting, free flight, lessons and tours,
// anywhere) a small table per device - what you want to do, and how.
export function renderControlsHelp(): HTMLElement {
  const { title, intro, sections } = msg.controls
  const wrapper = Object.assign(document.createElement('section'), { className: 'hud-controls-help' })
  wrapper.append(Object.assign(document.createElement('h3'), { className: 'hud-group-title', textContent: title }), Object.assign(document.createElement('p'), { textContent: intro }))
  for (const section of sections) {
    const details = document.createElement('details')
    details.append(Object.assign(document.createElement('summary'), { textContent: section.title }))
    for (const { device, rows } of section.devices) details.append(deviceTable(device, rows))
    wrapper.append(details)
  }
  return wrapper
}

function deviceTable(device: string, rows: [string, string][]): HTMLTableElement {
  const table = Object.assign(document.createElement('table'), { className: 'hud-controls-table' })
  table.createCaption().textContent = device
  const body = table.createTBody()
  for (const [action, how] of rows) {
    const row = body.insertRow()
    row.append(Object.assign(document.createElement('th'), { scope: 'row', textContent: action }))
    row.insertCell().textContent = how
  }
  return table
}
