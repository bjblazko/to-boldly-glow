import './app/page.css'
import './hud/hud.css'
import { startApp } from './app/app'
import { showStartupError } from './app/errorMessages'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (!canvas) throw new Error('Canvas element #scene not found.')
startApp(canvas).catch((error: unknown) => showStartupError(canvas, error))
