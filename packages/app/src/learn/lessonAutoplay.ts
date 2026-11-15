import { msg } from '../i18n/i18n'

// A chapter stays on at least this long, and a moment longer than its reading takes.
const MIN_CHAPTER_SECONDS = 6
const PAUSE_AFTER_READING_SECONDS = 1.5

// The lesson dock's play button: off by default (a lesson is turned page by page); on, it turns to
// the next chapter by itself once the narrator has read the chapter (without sound: once reading
// it would take) - and stops at the last chapter. Turning a page by hand restarts the wait.
export class LessonAutoplay {
  private playing = false
  private remainingSeconds = 0

  constructor(
    private readonly button: HTMLButtonElement,
    private readonly advance: () => void,
  ) {
    button.addEventListener('click', () => this.setPlaying(!this.playing))
    this.render()
  }

  get isPlaying(): boolean {
    return this.playing
  }

  setPlaying(playing: boolean): void {
    this.playing = playing
    this.render()
  }

  // A chapter has just been shown: wait as long as it takes to read.
  chapterShown(readingSeconds: number): void {
    this.remainingSeconds = Math.max(MIN_CHAPTER_SECONDS, readingSeconds + PAUSE_AFTER_READING_SECONDS)
  }

  update(deltaSeconds: number): void {
    if (!this.playing) return
    this.remainingSeconds -= deltaSeconds
    if (this.remainingSeconds <= 0) this.advance()
  }

  private render(): void {
    const label = this.playing ? msg.ui.lesson.autoplayStop : msg.ui.lesson.autoplay
    this.button.dataset.state = this.playing ? 'playing' : 'paused'
    this.button.setAttribute('aria-pressed', String(this.playing))
    this.button.setAttribute('aria-label', label)
    this.button.title = label
    const text = this.button.querySelector('.hud-dock-label')
    if (text) text.textContent = this.playing ? msg.ui.dock.pause : msg.ui.dock.play
  }
}
