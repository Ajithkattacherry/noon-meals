import { describe, expect, it } from 'vitest'
import { findApplicablePrice, weekStart } from './pricing'
import type { Purchase } from './types'

function purchase(
  id: string,
  ingredientId: string,
  purchaseDate: string,
  unitPrice: number,
  createdAt = `${purchaseDate}T08:00:00.000Z`,
): Purchase {
  return { id, ingredientId, purchaseDate, unitPrice, createdAt }
}

describe('weekStart', () => {
  it('returns the Monday of the week for a Thursday', () => {
    expect(weekStart('2026-11-26')).toBe('2026-11-23')
  })

  it('treats Sunday as the last day of the same week', () => {
    expect(weekStart('2026-11-29')).toBe('2026-11-23')
  })

  it('returns the same day for a Monday', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23')
  })

  it('crosses a month boundary', () => {
    expect(weekStart('2026-12-01')).toBe('2026-11-30')
  })
})

describe('findApplicablePrice', () => {
  const menuDate = '2026-11-26'

  it('uses a purchase made earlier in the same week without a marker', () => {
    const result = findApplicablePrice(
      [purchase('p1', 'onion', '2026-11-24', 40)],
      'onion',
      menuDate,
    )
    expect(result).toEqual({
      purchaseId: 'p1',
      purchaseDate: '2026-11-24',
      unitPrice: 40,
      carriedOver: false,
    })
  })

  it('marks a purchase from a previous week as carried over', () => {
    const result = findApplicablePrice(
      [purchase('p1', 'onion', '2026-11-22', 40)],
      'onion',
      menuDate,
    )
    expect(result?.carriedOver).toBe(true)
  })

  it('ignores purchases dated after the menu date', () => {
    expect(
      findApplicablePrice([purchase('p1', 'onion', '2026-11-27', 40)], 'onion', menuDate),
    ).toBeNull()
  })

  it('returns null when the ingredient has no purchases', () => {
    expect(
      findApplicablePrice([purchase('p1', 'tomato', '2026-11-24', 30)], 'onion', menuDate),
    ).toBeNull()
  })

  it('picks the most recent purchase on or before the menu date', () => {
    const result = findApplicablePrice(
      [
        purchase('old', 'onion', '2026-11-10', 40),
        purchase('new', 'onion', '2026-11-17', 45),
      ],
      'onion',
      menuDate,
    )
    expect(result).toMatchObject({
      purchaseId: 'new',
      purchaseDate: '2026-11-17',
      unitPrice: 45,
    })
  })

  it('breaks a same-date tie with the later createdAt', () => {
    const result = findApplicablePrice(
      [
        purchase('first', 'onion', '2026-11-24', 40, '2026-11-24T08:00:00.000Z'),
        purchase('second', 'onion', '2026-11-24', 44, '2026-11-24T18:00:00.000Z'),
      ],
      'onion',
      menuDate,
    )
    expect(result?.purchaseId).toBe('second')
    expect(result?.unitPrice).toBe(44)
  })

  it('ignores purchases of other ingredients', () => {
    const result = findApplicablePrice(
      [
        purchase('p1', 'onion', '2026-11-24', 40),
        purchase('p2', 'tomato', '2026-11-25', 99),
      ],
      'onion',
      menuDate,
    )
    expect(result?.purchaseId).toBe('p1')
  })
})
