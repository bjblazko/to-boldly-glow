// The HUD's typefaces, bundled with the app rather than fetched from a font service.
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/inter-tight/wght-italic.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './app/page.css'
import './hud/hud.css'
import { startApp } from './app/app'
import { showStartupError } from './app/errorMessages'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (!canvas) throw new Error('Canvas element #scene not found.')
startApp(canvas).catch((error: unknown) => showStartupError(canvas, error))
