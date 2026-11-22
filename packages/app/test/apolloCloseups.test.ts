import { describe, expect, it } from 'vitest'
import { actorPoint, CLOSEUPS, CM_APEX, LM_TOP, posesAt, type ActorPose, type CloseupId } from '../src/learn/apolloRoute/closeupChoreography'

type V = ArrayLike<number>
const distance = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function actor(id: CloseupId, seconds: number, model: ActorPose['model']): ActorPose {
  const pose = posesAt(id, seconds).find((candidate) => candidate.model === model)
  if (!pose) throw new Error(`no ${model} in ${id}`)
  return pose
}

// Columbia's apex (the probe) against Eagle's docking ring (the drogue).
function gap(id: CloseupId, seconds: number): number {
  return distance(actorPoint(actor(id, seconds, 'csm'), CM_APEX, 'cm'), actorPoint(actor(id, seconds, 'lm'), LM_TOP, 'ascent'))
}

describe('the Apollo 11 close-ups', () => {
  it('each plays for a while and then holds', () => {
    for (const id of Object.keys(CLOSEUPS) as CloseupId[]) {
      const end = CLOSEUPS[id].seconds
      expect(JSON.stringify(posesAt(id, end))).toBe(JSON.stringify(posesAt(id, end + 30)))
    }
  })

  it('transposition: Columbia leaves the stage clear of Eagle, turns round, docks nose to Eagle’s roof and pulls it out', () => {
    expect(gap('transposition', 0)).toBeGreaterThan(0.3)
    const csmBefore = actorPoint(actor('transposition', 0, 'csm'), CM_APEX, 'cm')
    const csmTurned = actorPoint(actor('transposition', 7.5, 'csm'), CM_APEX, 'cm')
    expect(csmTurned[1]).toBeLessThan(actorPoint(actor('transposition', 7.5, 'csm'), [0, 0, 0], 'sps')[1])
    expect(csmBefore[1]).toBeGreaterThan(0)
    expect(gap('transposition', 11)).toBeLessThan(0.05)
    expect(gap('transposition', CLOSEUPS.transposition.seconds)).toBeLessThan(0.05)
    const lmStart = actorPoint(actor('transposition', 0, 'lm'), LM_TOP, 'ascent')
    const lmEnd = actorPoint(actor('transposition', CLOSEUPS.transposition.seconds, 'lm'), LM_TOP, 'ascent')
    expect(lmEnd[1] - lmStart[1]).toBeGreaterThan(10)
    expect(actor('transposition', 3, 'saturnV').visibility.sla).toBe(0)
    // Folded, Eagle's struts and probes are tucked away (as in the Eagle lesson).
    for (const t of [0, 11, CLOSEUPS.transposition.seconds]) expect(actor('transposition', t, 'lm').fold).toBe(1)
  })

  it('undocking: docked at first, the legs unfold, then Eagle drifts off and turns round once', () => {
    expect(gap('undocking', 0)).toBeLessThan(0.05)
    expect(actor('undocking', 0, 'lm').fold).toBe(1)
    expect(actor('undocking', CLOSEUPS.undocking.seconds, 'lm').fold).toBe(0)
    expect(actor('undocking', 0, 'lm').fold).toBe(1)
    expect(actor('undocking', CLOSEUPS.undocking.seconds, 'lm').fold).toBe(0)
    expect(gap('undocking', CLOSEUPS.undocking.seconds)).toBeGreaterThan(8)
  })

  it('landing: Eagle comes down from high up and stands on its footpads on the ground', () => {
    const footpad = (seconds: number) => actorPoint(actor('landing', seconds, 'lm'), [0, 0, 0], 'descent')
    expect(footpad(0)[1]).toBeGreaterThan(30)
    expect(footpad(CLOSEUPS.landing.seconds)[1]).toBeCloseTo(0, 6)
    expect(footpad(CLOSEUPS.landing.seconds)[0]).toBeCloseTo(0, 6)
  })

  it('liftoff: the ascent stage rises from the descent stage, which stays', () => {
    const end = actor('liftoff', CLOSEUPS.liftoff.seconds, 'lm')
    expect(actorPoint(end, LM_TOP, 'ascent')[1] - LM_TOP[1]).toBeGreaterThan(20)
    expect(actorPoint(end, [0, 0, 0], 'descent')[1]).toBeCloseTo(0, 6)
  })

  it('liftoff: the camera follows the ascent stage up', () => {
    const follow = CLOSEUPS.liftoff.follow!
    const end = CLOSEUPS.liftoff.seconds
    expect(follow(0)[1]).toBeCloseTo(6, 6)
    expect(follow(end)[1]).toBeCloseTo(actorPoint(actor('liftoff', end, 'lm'), [0, 5.14, 0], 'ascent')[1], 4)
  })

  it('rendezvous: the ascent stage alone comes up to Columbia and docks, then is cast off', () => {
    expect(actor('rendezvous', 0, 'lm').visibility.descent).toBe(0)
    expect(gap('rendezvous', 0)).toBeGreaterThan(15)
    expect(gap('rendezvous', 9)).toBeLessThan(0.05)
    expect(actor('rendezvous', CLOSEUPS.rendezvous.seconds, 'lm').visibility.ascent).toBe(0)
  })

  it('before entry: the service module drops back, the command module stays put and turns its heat shield forward', () => {
    const apex = (seconds: number) => actorPoint(actor('entry', seconds, 'csm'), CM_APEX, 'cm')
    const shield = (seconds: number) => actorPoint(actor('entry', seconds, 'csm'), [0, 7.17, 0], 'cm')
    const nozzle = (seconds: number) => actorPoint(actor('entry', seconds, 'csm'), [0, 0, 0], 'sps')
    expect(distance(apex(0), apex(5))).toBeLessThan(0.01)
    expect(distance(nozzle(0), nozzle(5))).toBeGreaterThan(15)
    expect(actor('entry', 7, 'csm').visibility.sm).toBe(0)
    const end = CLOSEUPS.entry.seconds
    expect(shield(end)[1]).toBeGreaterThan(apex(end)[1])
  })
})

describe('the ground under Eagle', () => {
  it("is the Moon's own surface: the flat facet of its drawn sphere right under the landing site", async () => {
    const { groundUnderSite } = await import('../src/learn/apolloRoute/closeupFrames')
    const { ROUTE_MOON, ROUTE_MOON_RADIUS, LANDING_SITE } = await import('../src/learn/apolloRoute/routeGeometry')
    const ground = groundUnderSite()
    const fromCentre = distance(ground.point, ROUTE_MOON)
    expect(fromCentre).toBeLessThanOrEqual(ROUTE_MOON_RADIUS * (1 + 1e-6))
    expect(fromCentre).toBeGreaterThan(ROUTE_MOON_RADIUS * 0.997)
    const radial = [0, 1, 2].map((k) => (LANDING_SITE[k] - ROUTE_MOON[k]) / ROUTE_MOON_RADIUS)
    expect(ground.normal[0] * radial[0] + ground.normal[1] * radial[1] + ground.normal[2] * radial[2]).toBeGreaterThan(0.998)
  })
})

describe('the close-up of the entry', () => {
  it('looks out from between Earth and the command module, so the dark night side is not behind it', async () => {
    const { closeupShot, closeupFrame } = await import('../src/learn/apolloRoute/closeupFrames')
    const { orbitBasisForUpAxis } = await import('../src/camera/orbitCamera')
    const { ROUTE_EARTH } = await import('../src/learn/apolloRoute/routeGeometry')
    const { preset } = closeupShot('entry')
    const { right, forward0 } = orbitBasisForUpAxis(preset.upAxis)
    const toEye = [0, 1, 2].map((k) => Math.cos(preset.elevation) * (Math.sin(preset.azimuth) * right[k] + Math.cos(preset.azimuth) * forward0[k]) + Math.sin(preset.elevation) * preset.upAxis[k])
    const origin = closeupFrame('entry').origin
    const towardEarth = ROUTE_EARTH.map((value, k) => value - origin[k])
    const length = Math.hypot(...towardEarth)
    expect(toEye.reduce((sum, value, k) => sum + (value * towardEarth[k]) / length, 0)).toBeGreaterThan(0.5)
  })
})
