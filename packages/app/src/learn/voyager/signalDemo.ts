import { msg } from '../../i18n/i18n'
import { decodeLine, encodePicture, LINE_SAMPLES, PICTURE_HEIGHT, PICTURE_WIDTH, SYNC_LEVEL, testPicture } from './pictureSignal'

// Lines drawn per second: the picture builds up in three seconds, holds, and starts over.
const LINES_PER_SECOND = 24
const HOLD_SECONDS = 1.5
const AUDIO_SAMPLE_RATE = 24000
const AUDIO_VOLUME = 0.25
const WAVE = { width: 320, height: 56 }
const PICTURE_SCALE = 2

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The deep dive's demonstration: the signal of each line as it plays, and the picture building up
// line by line from it. "Listen" makes the same signal audible - computed in the browser, nothing
// is loaded. Stops (animation and sound) when the chapter changes.
export class SignalDemo {
  readonly element: HTMLElement
  private readonly signal = encodePicture(testPicture(), PICTURE_WIDTH)
  private readonly wave: CanvasRenderingContext2D
  private readonly picture: CanvasRenderingContext2D
  private readonly image: ImageData
  private frame = 0
  private startMs = 0
  private drawnLines = 0
  private audio: { context: AudioContext; source: AudioBufferSourceNode } | null = null

  constructor() {
    const waveCanvas = canvas(WAVE.width, WAVE.height, 'hud-signal-wave')
    const pictureCanvas = canvas(PICTURE_WIDTH, PICTURE_HEIGHT, 'hud-signal-picture')
    pictureCanvas.style.width = `${PICTURE_WIDTH * PICTURE_SCALE}px`
    this.wave = waveCanvas.getContext('2d')!
    this.picture = pictureCanvas.getContext('2d')!
    this.image = this.picture.createImageData(PICTURE_WIDTH, PICTURE_HEIGHT)
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-signal-listen', textContent: msg.voyager.signal.listen })
    button.addEventListener('click', () => this.listen())
    const note = Object.assign(document.createElement('span'), { className: 'hud-lesson-media-credit', textContent: msg.voyager.signal.note })
    this.element = Object.assign(document.createElement('div'), { className: 'hud-signal-demo' })
    this.element.append(waveCanvas, pictureCanvas, button, note)
    this.start()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.stopAudio()
  }

  private start(): void {
    if (prefersReducedMotion()) {
      this.drawUpTo(PICTURE_HEIGHT)
      this.drawWave(PICTURE_HEIGHT / 2)
      return
    }
    this.startMs = performance.now()
    this.drawnLines = 0
    const tick = (now: number) => {
      this.animate(now)
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  private animate(nowMs: number): void {
    const cycleSeconds = PICTURE_HEIGHT / LINES_PER_SECOND + HOLD_SECONDS
    const seconds = ((nowMs - this.startMs) / 1000) % cycleSeconds
    const line = Math.min(PICTURE_HEIGHT, Math.floor(seconds * LINES_PER_SECOND))
    if (line < this.drawnLines) this.clearPicture()
    this.drawUpTo(line)
    this.drawWave(Math.min(line, PICTURE_HEIGHT - 1))
  }

  private clearPicture(): void {
    this.image.data.fill(0)
    this.drawnLines = 0
  }

  // Decodes the lines not drawn yet, from the signal, into the picture.
  private drawUpTo(lines: number): void {
    for (let line = this.drawnLines; line < lines; line++) {
      decodeLine(this.signal, line, PICTURE_WIDTH).forEach((level, x) => {
        const offset = (line * PICTURE_WIDTH + x) * 4
        this.image.data.set([level * 255, level * 230, level * 150, 255], offset)
      })
    }
    this.drawnLines = Math.max(this.drawnLines, lines)
    this.picture.putImageData(this.image, 0, 0)
  }

  // The signal of one line: the sync pulse dips below black, then the brightness along the line.
  private drawWave(line: number): void {
    const { width, height } = WAVE
    const context = this.wave
    context.clearRect(0, 0, width, height)
    context.strokeStyle = '#ffcf4a'
    context.lineWidth = 1.5
    context.beginPath()
    const level = (value: number) => height - 6 - ((value - SYNC_LEVEL) / (1 - SYNC_LEVEL)) * (height - 12)
    for (let sample = 0; sample < LINE_SAMPLES; sample++) {
      const x = (sample / (LINE_SAMPLES - 1)) * width
      const y = level(this.signal[line * LINE_SAMPLES + sample])
      if (sample === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.stroke()
  }

  // Plays the whole picture's signal as sound, in step with the drawing (which starts over with it).
  private listen(): void {
    this.stopAudio()
    const context = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
    const source = context.createBufferSource()
    source.buffer = this.audioBuffer(context)
    const gain = context.createGain()
    gain.gain.value = AUDIO_VOLUME
    source.connect(gain).connect(context.destination)
    source.start()
    source.addEventListener('ended', () => this.stopAudio())
    this.audio = { context, source }
    this.clearPicture()
    this.startMs = performance.now()
  }

  // The signal stretched to the drawing's pace: one line every 1/24 second.
  private audioBuffer(context: AudioContext): AudioBuffer {
    const samplesPerSignalSample = AUDIO_SAMPLE_RATE / (LINES_PER_SECOND * LINE_SAMPLES)
    const buffer = context.createBuffer(1, Math.ceil(this.signal.length * samplesPerSignalSample), AUDIO_SAMPLE_RATE)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index++) data[index] = Math.max(-1, this.signal[Math.floor(index / samplesPerSignalSample)] * 2 - 1)
    return buffer
  }

  private stopAudio(): void {
    if (!this.audio) return
    this.audio.source.stop()
    void this.audio.context.close()
    this.audio = null
  }
}

function canvas(width: number, height: number, className: string): HTMLCanvasElement {
  return Object.assign(document.createElement('canvas'), { width, height, className })
}
