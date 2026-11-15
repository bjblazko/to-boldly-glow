import { describe, expect, it } from 'vitest'
import { ENCOUNTER_SPAN_SECONDS, FADE_SECONDS, MissionPlayer, type MissionPlan } from '../src/missions/missionPlayer'

// A launch, a flyby 550 days later, a milestone 4,000 days after that.
const PLAN: MissionPlan = {
  stations: [
    { day: 0, encounter: false },
    { day: 550, encounter: true },
    { day: 4550, encounter: false },
  ],
  readingSeconds: () => 10,
}

function player(animate = true) {
  const arrived: number[] = []
  let ended = false
  const tour = new MissionPlayer(PLAN, { arrived: (index) => arrived.push(index), ended: () => (ended = true) }, animate)
  tour.start()
  return { tour, arrived, ended: () => ended }
}

function run(tour: MissionPlayer, seconds: number, step = 0.05) {
  for (let t = 0; t < seconds; t += step) tour.update(step)
  return tour.moment
}

describe('a mission tour', () => {
  it('opens the first station and holds there while its text is read out', () => {
    const { tour, arrived } = player()
    expect(arrived).toEqual([0])
    expect(run(tour, 11).phase).toBe('hold')
    expect(run(tour, 1.5).phase).toBe('flight')
  })

  it('races through the middle of a leg and slows toward the next station', () => {
    const { tour } = player()
    run(tour, 12.1)
    const days = [0, 1, 2, 3, 4, 5, 6, 7].map(() => run(tour, 1).day)
    const steps = days.slice(1).map((day, index) => day - days[index])
    expect(steps.every((step) => step >= 0)).toBe(true)
    expect(Math.max(...steps)).toBeGreaterThan(steps[0] * 2)
  })

  it('fades into a flyby, plays its clock through closest approach slowest, and fades out', () => {
    const { tour, arrived } = player()
    let moment = run(tour, 12.1)
    while (moment.phase === 'flight') moment = tour.update(0.05)
    expect(moment.phase).toBe('fadeIn')
    moment = run(tour, FADE_SECONDS + 0.05)
    expect(moment.phase).toBe('encounter')
    expect(arrived).toEqual([0, 1])
    expect(moment.encounterSeconds).toBeLessThan(-0.9 * ENCOUNTER_SPAN_SECONDS)
    const before = run(tour, 8).encounterSeconds
    const after = run(tour, 0.5).encounterSeconds
    expect(Math.abs(after - before)).toBeLessThan(ENCOUNTER_SPAN_SECONDS / 20)
    expect(run(tour, 12).phase).toMatch(/fadeOut|flight/)
  })

  it('stands still while paused', () => {
    const { tour } = player()
    run(tour, 14)
    tour.setPaused(true)
    const day = tour.moment.day
    expect(run(tour, 5).day).toBe(day)
    tour.setPaused(false)
    expect(run(tour, 1).day).toBeGreaterThan(day)
  })

  it('finishes a fade before it pauses, so it never stands still half dark', () => {
    const { tour } = player()
    run(tour, 12.1)
    let moment = tour.moment
    while (moment.phase === 'flight') moment = tour.update(0.05)
    tour.setPaused(true)
    moment = run(tour, 3)
    expect(moment.phase).toBe('encounter')
    expect(moment.paused).toBe(true)
  })

  it('jumps to a station and opens its card', () => {
    const { tour, arrived } = player()
    tour.jumpTo(2)
    expect(tour.moment.day).toBe(4550)
    expect(arrived).toEqual([0, 2])
  })

  it('ends after the last station', () => {
    const { tour, ended } = player()
    tour.jumpTo(2)
    expect(run(tour, 13).phase).toBe('end')
    expect(ended()).toBe(true)
  })

  it('cuts instead of flying without motion', () => {
    const { tour } = player(false)
    run(tour, 12.1)
    expect(tour.moment.phase).toBe('fadeIn')
  })
})
