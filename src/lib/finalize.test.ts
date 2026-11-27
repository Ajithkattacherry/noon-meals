import { describe, expect, it } from 'vitest'
import { canFinalize } from './finalize'
import type { DayCalculation } from './types'

function calc(overrides: Partial<DayCalculation> = {}): DayCalculation {
  return {
    menuDate: '2026-11-26',
    studentCount: 100,
    bufferPercent: 0,
    recipes: [],
    flags: [],
    total: 365,
    complete: true,
    costPerChild: 3.65,
    ...overrides,
  }
}

describe('canFinalize', () => {
  it('allows a complete day', () => {
    expect(canFinalize(calc())).toBe(true)
  })

  it('blocks a day with a missing price', () => {
    expect(
      canFinalize(
        calc({
          complete: false,
          costPerChild: null,
          flags: [{ kind: 'missing_price', recipeId: 'curry', ingredientId: 'coconut' }],
        }),
      ),
    ).toBe(false)
  })

  it('blocks a day with a unit mismatch', () => {
    expect(
      canFinalize(
        calc({
          complete: false,
          flags: [{ kind: 'unit_mismatch', recipeId: 'curry', ingredientId: 'chilli' }],
        }),
      ),
    ).toBe(false)
  })
})
