import { describe, expect, it } from 'vitest'
import { scaleQuantity } from './scaling'

describe('scaleQuantity', () => {
  it('doubles a weight when the student count doubles the base servings', () => {
    expect(scaleQuantity(2, 100, 50, 0, 'Kg')).toBe(4)
  })

  it('keeps decimals for weights', () => {
    expect(scaleQuantity(0.25, 100, 50, 0, 'Kg')).toBe(0.5)
  })

  it('rounds whole items up', () => {
    expect(scaleQuantity(5, 37, 50, 0, 'Each')).toBe(4)
  })

  it('does not round 10 Each up to 11 because of float noise', () => {
    expect(scaleQuantity(5, 100, 50, 0, 'Each')).toBe(10)
  })

  it('applies the buffer percentage', () => {
    expect(scaleQuantity(2, 100, 50, 10, 'Kg')).toBe(4.4)
  })

  it('rounds weights to three decimals', () => {
    expect(scaleQuantity(1, 1, 3, 0, 'Kg')).toBe(0.333)
  })

  it('returns zero for zero students', () => {
    expect(scaleQuantity(2, 0, 50, 0, 'Kg')).toBe(0)
    expect(scaleQuantity(5, 0, 50, 0, 'Each')).toBe(0)
  })

  it('throws when base servings are not positive', () => {
    expect(() => scaleQuantity(1, 10, 0, 0, 'Kg')).toThrow()
  })
})
