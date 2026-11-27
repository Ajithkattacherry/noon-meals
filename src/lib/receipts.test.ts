import { describe, expect, it } from 'vitest'
import {
  determineTargetType,
  matchIngredient,
  normalizeParsedReceipt,
  normalizeUnit,
} from './receipts'
import type { Ingredient } from './types'

const ingredients: Ingredient[] = [
  { id: 'onion', name: 'Onion', unit: 'Kg', category: 'vegetable', active: true },
  { id: 'dal', name: 'Toor Dal', unit: 'Kg', category: 'grocery', active: true },
  { id: 'rice', name: 'Rice', unit: 'Kg', category: 'fixed', active: true },
  { id: 'old', name: 'Old Item', unit: 'Kg', category: 'grocery', active: false },
]

describe('normalizeUnit', () => {
  it('maps common receipt unit abbreviations to supported Units', () => {
    expect(normalizeUnit('kg')).toBe('Kg')
    expect(normalizeUnit('gms')).toBe('Gram')
    expect(normalizeUnit('ltr')).toBe('Liter')
    expect(normalizeUnit('ml')).toBe('Millilitre')
    expect(normalizeUnit('pkt')).toBe('Each')
    expect(normalizeUnit('unknown')).toBe('Each')
  })
})

describe('matchIngredient', () => {
  it('matches active ingredients by exact or partial name and skips inactive', () => {
    expect(matchIngredient(['Onion'], ingredients)?.id).toBe('onion')
    expect(matchIngredient(['Savala Onion'], ingredients)?.id).toBe('onion')
    expect(matchIngredient(['Old Item'], ingredients)).toBeNull()
  })
})

describe('normalizeParsedReceipt', () => {
  it('routes matched items to purchase and fixed/gas items to fixed_bill', () => {
    const parsed = normalizeParsedReceipt(
      {
        supplier: 'Cheerakuzhy Stores',
        billNumber: '118',
        billDate: '2026-10-03',
        totalAmount: 2942.5,
        items: [
          {
            rawName: 'സവാള (Onion)',
            matchedIngredientName: 'Onion',
            quantity: 10,
            unit: 'kg',
            totalPrice: 450,
          },
          {
            rawName: 'Gas Cylinder',
            destination: 'fixed_bill',
            category: 'fixed',
            quantity: 1,
            unit: 'Each',
            totalPrice: 1952.6,
          },
        ],
      },
      ingredients,
      '2026-11-27',
    )

    expect(parsed.supplier).toBe('Cheerakuzhy Stores')
    expect(parsed.billDate).toBe('2026-10-03')
    expect(parsed.items[0]).toMatchObject({
      matchedIngredientId: 'onion',
      destination: 'purchase',
      unit: 'Kg',
      totalPrice: 450,
    })
    expect(parsed.items[1]).toMatchObject({
      destination: 'fixed_bill',
      category: 'fixed',
      totalPrice: 1952.6,
    })
    expect(determineTargetType(parsed.items)).toBe('mixed')
  })

  it('falls back to fallbackDate when billDate is missing or invalid', () => {
    const parsed = normalizeParsedReceipt(
      { billDate: 'invalid-date', items: [] },
      ingredients,
      '2026-11-27',
    )
    expect(parsed.billDate).toBe('2026-11-27')
  })
})
