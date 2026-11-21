import { describe, expect, it } from 'vitest'
import { CSM_ASSEMBLIES, csmAssemblyKind, csmParts } from '../src/apollo/csmParts'
import { CABIN_SCAN, CSM_HEIGHTS, CSM_RADIUS, SECTOR_DEGREES, TANKS } from '../src/apollo/csmProfile'

const FT = 0.3048
const IN = 0.0254

describe('the command and service module', () => {
  it('has the News Reference sizes: the CM 10 ft 7 in tall, the SM 24 ft 2 in, both 12 ft 10 in across', () => {
    expect(CSM_HEIGHTS.cmTop - CSM_HEIGHTS.cmBase).toBeCloseTo(10 * FT + 7 * IN, 3)
    expect(CSM_HEIGHTS.smTop - CSM_HEIGHTS.nozzleExit).toBeCloseTo(24 * FT + 2 * IN, 3)
    expect(CSM_RADIUS * 2).toBeCloseTo(12 * FT + 10 * IN, 3)
  })

  it('divides the SM into six sectors that go once around', () => {
    expect(SECTOR_DEGREES.reduce((sum, degrees) => sum + degrees, 0)).toBe(360)
  })

  it('keeps every tank and fuel cell inside the SM, between its aft bulkhead and its top', () => {
    for (const tank of TANKS) {
      const where = `${tank.contents} in sector ${tank.sector}`
      expect(tank.out + tank.radius, where).toBeLessThan(CSM_RADIUS)
      expect(tank.bottom, where).toBeGreaterThan(CSM_HEIGHTS.aftBulkhead)
      expect(tank.bottom + tank.height, where).toBeLessThan(CSM_HEIGHTS.smTop)
    }
  })

  it('builds every assembly; only the SM is cut open, showing what is inside it', () => {
    expect([...csmParts().keys()].sort()).toEqual([...CSM_ASSEMBLIES].sort())
    expect(CSM_ASSEMBLIES.filter((assembly) => csmAssemblyKind(assembly) === 'shell')).toEqual(['sm'])
    expect(CSM_ASSEMBLIES.filter((assembly) => csmAssemblyKind(assembly) === 'inside')).toEqual(['smInside'])
  })

  it('puts the scanned cabin floor above the heat shield and the cabin (2.5 m) below the apex', () => {
    const floor = CSM_HEIGHTS.cmBase + CABIN_SCAN.floorAboveBase
    const cabinHeight = (128 - CABIN_SCAN.floor) * CABIN_SCAN.centimetre // the scan reaches y 128 cm
    expect(floor + cabinHeight).toBeLessThan(CSM_HEIGHTS.cmTop)
  })
})
