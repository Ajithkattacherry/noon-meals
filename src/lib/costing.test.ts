import { describe, expect, it } from 'vitest'
import { computeDay } from './costing'
import type { Ingredient, Purchase, Recipe } from './types'

const onion: Ingredient = { id: 'onion', name: 'Onion', unit: 'Kg' }
const tomato: Ingredient = { id: 'tomato', name: 'Tomato', unit: 'Kg' }
const chilli: Ingredient = { id: 'chilli', name: 'Green Chilli', unit: 'Kg' }
const coconut: Ingredient = { id: 'coconut', name: 'Coconut', unit: 'Each' }
const rice: Ingredient = { id: 'rice', name: 'Rice', unit: 'Kg' }
const ingredients = [onion, tomato, chilli, coconut, rice]

const curry: Recipe = {
  id: 'curry',
  name: 'Vegetable Curry',
  baseServings: 50,
  items: [
    { ingredientId: 'onion', quantity: 2, unit: 'Kg' },
    { ingredientId: 'tomato', quantity: 1, unit: 'Kg' },
    { ingredientId: 'chilli', quantity: 250, unit: 'Gram' },
    { ingredientId: 'coconut', quantity: 5, unit: 'Each' },
  ],
}

const riceRecipe: Recipe = {
  id: 'rice',
  name: 'Steamed Rice',
  baseServings: 50,
  items: [{ ingredientId: 'rice', quantity: 2, unit: 'Kg' }],
}

function purchase(
  id: string,
  ingredientId: string,
  unitPrice: number,
  purchaseDate = '2026-11-24',
): Purchase {
  return {
    id,
    ingredientId,
    purchaseDate,
    unitPrice,
    createdAt: `${purchaseDate}T08:00:00.000Z`,
  }
}

const basePurchases = [
  purchase('p-onion', 'onion', 40),
  purchase('p-tomato', 'tomato', 30),
  purchase('p-chilli', 'chilli', 50),
]

const menuDate = '2026-11-26'

function compute(overrides?: Record<string, number>, bufferPercent = 0) {
  return computeDay({
    menuDate,
    studentCount: 100,
    bufferPercent,
    recipes: [curry],
    ingredients,
    purchases: basePurchases,
    overrides,
  })
}

describe('computeDay', () => {
  it('scales and prices each line and flags the missing coconut price', () => {
    const calc = compute()
    const lines = calc.recipes[0].lines

    const onionLine = lines.find((line) => line.ingredientId === 'onion')!
    expect(onionLine.scaledQuantity).toBe(4)
    expect(onionLine.cost).toBe(160)

    const tomatoLine = lines.find((line) => line.ingredientId === 'tomato')!
    expect(tomatoLine.cost).toBe(60)

    const chilliLine = lines.find((line) => line.ingredientId === 'chilli')!
    expect(chilliLine.baseQuantity).toBe(0.25)
    expect(chilliLine.scaledQuantity).toBe(0.5)
    expect(chilliLine.cost).toBe(25)

    const coconutLine = lines.find((line) => line.ingredientId === 'coconut')!
    expect(coconutLine.scaledQuantity).toBe(10)
    expect(coconutLine.price).toBeNull()
    expect(coconutLine.cost).toBeNull()

    expect(calc.total).toBe(245)
    expect(calc.flags).toEqual([
      { kind: 'missing_price', recipeId: 'curry', ingredientId: 'coconut' },
    ])
    expect(calc.complete).toBe(false)
    expect(calc.costPerChild).toBeNull()
  })

  it('is complete and computes cost per child once the coconut is priced', () => {
    const calc = computeDay({
      menuDate,
      studentCount: 100,
      bufferPercent: 0,
      recipes: [curry],
      ingredients,
      purchases: [...basePurchases, purchase('p-coconut', 'coconut', 12)],
    })
    expect(calc.total).toBe(365)
    expect(calc.complete).toBe(true)
    expect(calc.costPerChild).toBe(3.65)
  })

  it('handles a student count of zero without dividing by zero', () => {
    const calc = computeDay({
      menuDate,
      studentCount: 0,
      bufferPercent: 0,
      recipes: [curry],
      ingredients,
      purchases: [...basePurchases, purchase('p-coconut', 'coconut', 12)],
    })
    expect(calc.recipes[0].lines.every((line) => line.scaledQuantity === 0)).toBe(true)
    expect(calc.total).toBe(0)
    expect(calc.costPerChild).toBeNull()
  })

  it('flags an incompatible unit instead of pricing it', () => {
    const brokenCurry: Recipe = {
      ...curry,
      items: [{ ingredientId: 'chilli', quantity: 2, unit: 'Each' }],
    }
    const calc = computeDay({
      menuDate,
      studentCount: 100,
      bufferPercent: 0,
      recipes: [brokenCurry],
      ingredients,
      purchases: basePurchases,
    })
    expect(calc.flags).toContainEqual({
      kind: 'unit_mismatch',
      recipeId: 'curry',
      ingredientId: 'chilli',
    })
    expect(calc.recipes[0].lines[0].cost).toBeNull()
    expect(calc.complete).toBe(false)
  })

  it('uses an override quantity and marks the line as overridden', () => {
    const calc = compute({ 'curry:onion': 5 })
    const onionLine = calc.recipes[0].lines.find((line) => line.ingredientId === 'onion')!
    expect(onionLine.overridden).toBe(true)
    expect(onionLine.scaledQuantity).toBe(5)
    expect(onionLine.cost).toBe(200)
  })

  it('applies a buffer percentage', () => {
    const calc = compute(undefined, 10)
    const onionLine = calc.recipes[0].lines.find((line) => line.ingredientId === 'onion')!
    expect(onionLine.scaledQuantity).toBe(4.4)
    expect(onionLine.cost).toBe(176)
  })

  it('sums two recipes into one day total', () => {
    const calc = computeDay({
      menuDate,
      studentCount: 100,
      bufferPercent: 0,
      recipes: [curry, riceRecipe],
      ingredients,
      purchases: [
        ...basePurchases,
        purchase('p-coconut', 'coconut', 12),
        purchase('p-rice', 'rice', 25),
      ],
    })
    expect(calc.total).toBe(465)
    expect(calc.recipes).toHaveLength(2)
  })

  it('flags every missing price line but still sums the priced ones', () => {
    const calc = computeDay({
      menuDate,
      studentCount: 100,
      bufferPercent: 0,
      recipes: [curry, riceRecipe],
      ingredients,
      purchases: [],
    })
    expect(calc.flags).toHaveLength(5)
    expect(calc.total).toBe(0)
    expect(calc.complete).toBe(false)
  })
})
