// Startup failed (no WebGPU, no adapter, ...): the canvas is replaced by the reason.
export function showStartupError(canvas: HTMLCanvasElement | null, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  canvas?.replaceWith(document.createTextNode(`Failed to start renderer: ${message}`))
  console.error(error)
}

// The GPU device was lost while running (driver reset, GPU process crash): nothing renders anymore,
// so say so and offer a reload instead of leaving a frozen picture.
export function showDeviceLost(message: string): void {
  const alert = document.createElement('div')
  alert.className = 'gpu-lost-alert'
  alert.setAttribute('role', 'alert')
  alert.textContent = `The graphics device stopped working${message ? ` (${message})` : ''}. `
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.textContent = 'Reload'
  reload.addEventListener('click', () => location.reload())
  alert.appendChild(reload)
  document.body.appendChild(alert)
}
