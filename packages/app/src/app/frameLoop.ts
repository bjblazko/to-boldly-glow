export interface FrameTime {
  // Real time since the last frame: the simulation clock follows the wall clock exactly.
  realDeltaSeconds: number
  // The same, capped: animation, camera motion and tweens step at most this far per frame.
  deltaSeconds: number
  nowSeconds: number
}

// requestAnimationFrame pauses in hidden tabs, so the first frame back can report minutes. Without
// a cap the tour or a moving fly camera would integrate that whole gap in one step and teleport
// far off course, and every tween would finish at once.
const MAX_ANIMATION_DELTA_SECONDS = 0.1

export function runFrameLoop(renderFrame: (time: FrameTime) => void): void {
  let lastFrameTime = performance.now()
  const tick = () => {
    const now = performance.now()
    const realDeltaSeconds = (now - lastFrameTime) / 1000
    lastFrameTime = now
    renderFrame({ realDeltaSeconds, deltaSeconds: Math.min(realDeltaSeconds, MAX_ANIMATION_DELTA_SECONDS), nowSeconds: now / 1000 })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
