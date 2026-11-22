import { describe, expect, it } from 'vitest'
import { longitudeOf, parkingOrbit } from '../src/apollo/trajectory/apollo11Parking'
import { CHECKPOINTS, closestApproach, coast, correction, LOI, lunarArrival, MIDCOURSE, pericynthionFromLoi, solveCorrection, tliState, toMidcourse } from '../src/apollo/trajectory/apollo11Translunar'

const FT = 0.0003048
const NMI = 1.852
const EARTH_SPHERE = 3443.934 * NMI

describe("Apollo 11's coast to the Moon, reconstructed from the documented TLI state", () => {
  // Nothing is fitted up to the midcourse correction: these are the reconstruction's own checks.
  it('meets the documented altitude and speed at separation, the evasive maneuver and the midcourse correction', () => {
    const states: Record<number, ReturnType<typeof tliState>> = {}
    toMidcourse((state) => {
      for (const { get } of CHECKPOINTS) if (Math.abs(state.t - get) < 10.1 && !states[get]) states[get] = coast(state, get)
    })
    for (const { get, altitude, speed } of CHECKPOINTS) {
      const state = states[get]
      expect(Math.abs((Math.hypot(...state.position) - EARTH_SPHERE) / altitude - 1), `altitude at ${get} s`).toBeLessThan(0.005)
      expect(Math.abs(Math.hypot(...state.velocity) / speed - 1), `speed at ${get} s`).toBeLessThan(0.003)
    }
  })

  it('without the midcourse correction passes the Moon some 800-900 n mi up (the mission report: 896 n mi after TLI alone)', () => {
    const { altitude } = closestApproach(coast(tliState(), MIDCOURSE.get))
    expect(altitude / NMI).toBeGreaterThan(780)
    expect(altitude / NMI).toBeLessThan(960)
  })

  it('needs a correction of about the documented 20.9 ft/s to arrive as documented at lunar orbit insertion', () => {
    const atMidcourse = toMidcourse()
    const deltaV = solveCorrection(atMidcourse)
    expect(Math.hypot(...deltaV) / FT).toBeGreaterThan(17)
    expect(Math.hypot(...deltaV) / FT).toBeLessThan(25)
    const arrival = lunarArrival(coast(correction(atMidcourse, deltaV), LOI.get))
    expect(arrival.altitude / NMI).toBeCloseTo(86.7, 0)
    expect(arrival.speed / FT).toBeGreaterThan(8240)
    expect(arrival.speed / FT).toBeLessThan(8260)
    expect(arrival.flightPath).toBeCloseTo(-9.99, 1)
    expect(pericynthionFromLoi().altitude / NMI).toBeCloseTo(60.5, 0)
  }, 120000)
})

describe("Apollo 11's parking orbit, from the S-IVB's first cutoff", () => {
  it('comes round one and a half times to where the second burn was lit, over 172.55 degrees E (mission report)', () => {
    const atIgnition = parkingOrbit()
    expect(Math.abs(longitudeOf(atIgnition) - 172.55)).toBeLessThan(0.5)
    expect((Math.hypot(...atIgnition.position) - EARTH_SPHERE) / NMI).toBeGreaterThan(98)
    expect((Math.hypot(...atIgnition.position) - EARTH_SPHERE) / NMI).toBeLessThan(104)
  })
})

describe('Apollo 11 into lunar orbit', () => {
  it('needs an LOI of about the documented 2,917.5 ft/s (less the finite burn\'s losses), and two turns later meets the circularization burn\'s documented state', async () => {
    const { intoLunarOrbit, lunarAltitudeSpeed, CIRCULARIZATION_IGNITION } = await import('../src/apollo/trajectory/apollo11LunarOrbit')
    const { state, deltaV } = intoLunarOrbit()
    expect(deltaV / FT).toBeGreaterThan(2800)
    expect(deltaV / FT).toBeLessThan(2950)
    const atBurn = lunarAltitudeSpeed(coast(state, CIRCULARIZATION_IGNITION))
    expect(Math.abs(atBurn.altitude / NMI - 61.8)).toBeLessThan(3)
    expect(Math.abs(atBurn.speed / FT - 5477.3)).toBeLessThan(15)
  }, 120000)
})

describe("Apollo 11's way home, reconstructed backward from entry interface", () => {
  it('meets the documented state at the transearth correction unaided, and needs a correction of about the documented 4.8 ft/s to meet the state after TEI', async () => {
    const { backToTei, entryInterfaceState, solveTransearthCorrection, TEI_CUTOFF, TRANSEARTH_MIDCOURSE } = await import('../src/apollo/trajectory/apollo11Transearth')
    const atCorrection = coast(entryInterfaceState(), TRANSEARTH_MIDCOURSE.get)
    expect(Math.abs((Math.hypot(...atCorrection.position) - EARTH_SPHERE) / TRANSEARTH_MIDCOURSE.altitude - 1)).toBeLessThan(0.002)
    expect(Math.abs(Math.hypot(...atCorrection.velocity) / TRANSEARTH_MIDCOURSE.speed - 1)).toBeLessThan(0.002)
    const deltaV = solveTransearthCorrection(atCorrection)
    expect(Math.hypot(...deltaV) / FT).toBeGreaterThan(3)
    expect(Math.hypot(...deltaV) / FT).toBeLessThan(7)
    const after = lunarArrival(backToTei(atCorrection, deltaV))
    expect(Math.abs(after.altitude - TEI_CUTOFF.altitude) / NMI).toBeLessThan(1)
    expect(Math.abs(after.speed - TEI_CUTOFF.speed) / FT).toBeLessThan(5)
    expect(after.flightPath).toBeCloseTo(TEI_CUTOFF.flightPath, 1)
  }, 120000)
})
