import { describe, expect, it } from 'vitest'
import { startupTourWanted } from '../src/app/startupTour'

describe('startupTourWanted', () => {
  it('is wanted unless the address says ?tour=off', () => {
    expect(startupTourWanted('')).toBe(true)
    expect(startupTourWanted('?scale=compact')).toBe(true)
    expect(startupTourWanted('?tour=off')).toBe(false)
  })
})
