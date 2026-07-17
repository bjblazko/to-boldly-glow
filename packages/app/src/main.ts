import { calendarToJulianDay } from '@toboldlyglow/engine'

const jd = calendarToJulianDay(2000, 1, 1.5)
const appDiv = document.querySelector<HTMLDivElement>('#app')
if (appDiv) {
  appDiv.textContent = `Engine loaded. Julian Day for 2000-01-01 12:00 UTC: ${jd}`
}
