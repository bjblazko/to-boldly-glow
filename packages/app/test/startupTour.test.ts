import { describe, expect, it } from 'vitest'
import { markStartPageSeen, startPageSeen, startPageWanted } from '../src/app/startupTour'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) }
}

const blocked: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('startPageWanted', () => {
  it('opens by itself on a first visit only', () => {
    expect(startPageWanted('', false)).toBe(true)
    expect(startPageWanted('?scale=compact', false)).toBe(true)
    expect(startPageWanted('', true)).toBe(false)
  })

  it('never with ?tour=off, a still start for links and tests', () => {
    expect(startPageWanted('?tour=off', false)).toBe(false)
  })
})

describe('start page seen', () => {
  it('is remembered in the storage', () => {
    const storage = memoryStorage()
    expect(startPageSeen(storage)).toBe(false)
    markStartPageSeen(storage)
    expect(startPageSeen(storage)).toBe(true)
  })

  it('counts as unseen, and marking it is harmless, when storage is blocked or missing', () => {
    expect(startPageSeen(blocked)).toBe(false)
    expect(() => markStartPageSeen(blocked)).not.toThrow()
    expect(startPageSeen(null)).toBe(false)
    expect(() => markStartPageSeen(null)).not.toThrow()
  })
})
