import { describe, expect, it } from 'vitest'
import { areUnitsCompatible, compatibleUnits, convertQuantity } from './units'

describe('convertQuantity', () => {
  it('converts grams to kilograms', () => {
    expect(convertQuantity(250, 'Gram', 'Kg')).toBe(0.25)
  })

  it('converts litres to millilitres', () => {
    expect(convertQuantity(1, 'Liter', 'Millilitre')).toBe(1000)
  })

  it('keeps the same-unit quantity unchanged', () => {
    expect(convertQuantity(3, 'Each', 'Each')).toBe(3)
  })

  it('converts kilograms to grams', () => {
    expect(convertQuantity(2, 'Kg', 'Gram')).toBe(2000)
  })

  it('returns null for incompatible families', () => {
    expect(convertQuantity(5, 'Each', 'Kg')).toBeNull()
    expect(convertQuantity(2, 'Kg', 'Liter')).toBeNull()
    expect(convertQuantity(1, 'Millilitre', 'Gram')).toBeNull()
  })
})

describe('compatibleUnits', () => {
  it('offers only the units in the same family', () => {
    expect(compatibleUnits('Kg')).toEqual(['Kg', 'Gram'])
    expect(compatibleUnits('Liter')).toEqual(['Liter', 'Millilitre'])
    expect(compatibleUnits('Each')).toEqual(['Each'])
  })

  it('reports compatibility', () => {
    expect(areUnitsCompatible('Gram', 'Kg')).toBe(true)
    expect(areUnitsCompatible('Each', 'Kg')).toBe(false)
  })
})
