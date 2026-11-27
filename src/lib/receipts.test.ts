import { describe, expect, it } from 'vitest'
import {
  determineTargetType,
  findDuplicateReceipt,
  matchIngredient,
  normalizeParsedReceipt,
  normalizeUnit,
} from './receipts'
import type { Ingredient, ReceiptUploadRecord } from './types'

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

describe('findDuplicateReceipt', () => {
  const existing: ReceiptUploadRecord[] = [
    {
      id: 'r1',
      storagePath: '2026-10-03/bill118.jpg',
      fileName: 'bill118.jpg',
      mimeType: 'image/jpeg',
      fileHash: 'abc123',
      billNumber: 'No. 118',
      supplier: 'Cheerakuzhy Stores',
      billDate: '2026-10-03',
      totalAmount: 2942.5,
      targetType: 'purchase',
      status: 'saved',
      createdAt: '2026-10-03T09:00:00Z',
    },
  ]

  it('detects exact file hash duplicates', () => {
    const match = findDuplicateReceipt(existing, { fileHash: 'abc123' })
    expect(match?.reason).toBe('file_hash')
    expect(match?.record.id).toBe('r1')
  })

  it('detects supplier + bill number duplicates even with a different file hash', () => {
    const match = findDuplicateReceipt(existing, {
      fileHash: 'different',
      supplier: 'cheerakuzhy stores',
      billNumber: 'no. 118',
    })
    expect(match?.reason).toBe('bill_number')
  })

  it('detects bill date + total amount duplicates', () => {
    const match = findDuplicateReceipt(existing, {
      fileHash: 'different',
      billDate: '2026-10-03',
      totalAmount: 2942.5,
    })
    expect(match?.reason).toBe('date_amount')
  })

  it('returns null when no duplicate matches', () => {
    expect(
      findDuplicateReceipt(existing, {
        fileHash: 'xyz',
        supplier: 'Cheerakuzhy Stores',
        billNumber: 'No. 119',
        billDate: '2026-10-03',
        totalAmount: 2262.5,
      }),
    ).toBeNull()
  })
})
