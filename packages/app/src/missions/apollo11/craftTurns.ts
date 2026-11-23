import type { mat4 } from 'gl-matrix'
import type { Vec3 } from '../../math/tuples'
import type { Apollo11Scene } from './apollo11Scene'
import { columbiaAttitude, eagleAttitude } from './craftAttitude'
import type { CraftCast } from './craftChoreography'

// How Columbia and Eagle are turned at the scene's moment (model frame to the scene's), for the
// renderer and the shots alike: Eagle close by Columbia (the undocking, the last approach) is
// posed in Columbia's frame.
export function craftTurns(scene: Apollo11Scene, cast: CraftCast): { columbia: mat4 | null; eagle: mat4 | null } {
  const [motion, eagleMotion] = [scene.motion('columbia'), scene.motion('eagle')]
  const [columbiaKm, eagleKm] = [scene.craftKm('columbia'), scene.craftKm('eagle')]
  const columbia = motion ? columbiaAttitude({ get: scene.get, ...motion, toOther: toward(columbiaKm, eagleKm) }) : null
  if (!cast.eagle || !eagleMotion) return { columbia, eagle: null }
  const eagle = cast.eagle.frame === 'columbia' ? columbia : eagleAttitude({ get: scene.get, ...eagleMotion, toOther: toward(eagleKm, columbiaKm) })
  return { columbia, eagle }
}

function toward(from: Vec3 | null, to: Vec3 | null): Vec3 | null {
  if (!from || !to) return null
  const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  return Math.hypot(...d) > 1e-6 ? d : null
}
