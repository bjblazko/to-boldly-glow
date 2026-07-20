// Purely visual feedback for the time-shuttle slider: fills the track from the center (zero) tick
// out toward the thumb, and marks which side it's on. The shuttle's actual clock-driving logic
// lives entirely in TimeControlUI, which listens to the same input independently — this only
// paints what the value already means (negative = rewind, zero = stopped, positive = fast-forward)
// so the center-is-zero convention has a visual anchor instead of relying on the number alone.
export function initShuttleVisual(shuttleInput: HTMLInputElement, fillElement: HTMLElement): void {
  const min = Number(shuttleInput.min)
  const max = Number(shuttleInput.max)
  const halfSpan = (max - min) / 2

  function update(): void {
    const value = Number(shuttleInput.value)
    const percentOfHalf = (Math.abs(value) / halfSpan) * 50
    fillElement.classList.toggle('is-past', value < 0)
    fillElement.classList.toggle('is-future', value > 0)
    fillElement.style.width = `${percentOfHalf}%`
    fillElement.style.left = value < 0 ? `${50 - percentOfHalf}%` : '50%'
  }

  shuttleInput.addEventListener('input', update)
  update()
}
