import { describe, expect, it } from 'vitest'
import { summarizeByIngredient, summarizeByPeriod, summarizeByRecipe } from './reports'
import type { DayCalculation, RecipeCost } from './types'

function recipe(
  recipeId: string,
  name: string,
  lines: { ingredientId: string; ingredientName: string; unit: RecipeCost['lines'][number]['unit']; quantity: number; cost: number | null }[],
): RecipeCost {
  return {
    recipeId,
    name,
    baseServings: 50,
    cost: lines.reduce((sum, line) => sum + (line.cost ?? 0), 0),
    lines: lines.map((line) => ({
      recipeId,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      unit: line.unit,
      baseQuantity: line.quantity,
      scaledQuantity: line.quantity,
      overridden: false,
      price: {
        purchaseId: `p-${line.ingredientId}`,
        purchaseDate: '2026-11-24',
        unitPrice: 1,
        carriedOver: false,
      },
      cost: line.cost,
    })),
  }
}

function snapshot(
  menuDate: string,
  studentCount: number,
  total: number,
  recipes: RecipeCost[],
): DayCalculation {
  return {
    menuDate,
    studentCount,
    bufferPercent: 0,
    recipes,
    flags: [],
    total,
    complete: true,
    costPerChild: studentCount > 0 ? Math.round((total / studentCount) * 100) / 100 : null,
  }
}

const curry = (onionQuantity: number, onionCost: number) =>
  recipe('curry', 'Vegetable Curry', [
    { ingredientId: 'onion', ingredientName: 'Onion', unit: 'Kg', quantity: onionQuantity, cost: onionCost },
    { ingredientId: 'coconut', ingredientName: 'Coconut', unit: 'Each', quantity: 10, cost: 120 },
  ])

const day1 = snapshot('2026-11-26', 100, 365, [curry(4, 245)])
const day2 = snapshot('2026-11-29', 80, 300, [curry(3, 180)])
const day3 = snapshot('2026-11-30', 90, 330, [
  recipe('rice', 'Steamed Rice', [
    { ingredientId: 'rice', ingredientName: 'Rice', unit: 'Kg', quantity: 4, cost: 330 },
  ]),
])
const snapshots = [day1, day2, day3]

describe('summarizeByPeriod', () => {
  it('groups by day', () => {
    const rows = summarizeByPeriod(snapshots, 'day')
    expect(rows.map((row) => row.key)).toEqual(['2026-11-26', '2026-11-29', '2026-11-30'])
    expect(rows[0]).toMatchObject({ days: 1, studentDays: 100, total: 365, costPerChild: 3.65 })
  })

  it('groups by week with the Monday as key', () => {
    const rows = summarizeByPeriod(snapshots, 'week')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      key: '2026-11-23',
      days: 2,
      studentDays: 180,
      total: 665,
    })
    expect(rows[0].costPerChild).toBe(3.69)
    expect(rows[1]).toMatchObject({ key: '2026-11-30', days: 1, total: 330 })
  })

  it('groups by month', () => {
    const rows = summarizeByPeriod(snapshots, 'month')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: '2026-11',
      days: 3,
      studentDays: 270,
      total: 995,
    })
    expect(rows[0].costPerChild).toBe(3.69)
  })

  it('returns no cost per child when there are no student days', () => {
    const rows = summarizeByPeriod([snapshot('2026-11-26', 0, 0, [])], 'day')
    expect(rows[0].costPerChild).toBeNull()
  })
})

describe('summarizeByIngredient', () => {
  it('adds quantities and costs of the same ingredient across days', () => {
    const rows = summarizeByIngredient(snapshots)
    const onion = rows.find((row) => row.ingredientId === 'onion')
    expect(onion).toMatchObject({ quantity: 7, cost: 425, unit: 'Kg' })
    const coconut = rows.find((row) => row.ingredientId === 'coconut')
    expect(coconut).toMatchObject({ quantity: 20, cost: 240 })
    const rice = rows.find((row) => row.ingredientId === 'rice')
    expect(rice).toMatchObject({ quantity: 4, cost: 330 })
  })
})

describe('summarizeByRecipe', () => {
  it('counts times served and sums cost', () => {
    const rows = summarizeByRecipe(snapshots)
    const curryRow = rows.find((row) => row.recipeId === 'curry')
    expect(curryRow).toMatchObject({ timesServed: 2, cost: 665 })
    const riceRow = rows.find((row) => row.recipeId === 'rice')
    expect(riceRow).toMatchObject({ timesServed: 1, cost: 330 })
  })
})
