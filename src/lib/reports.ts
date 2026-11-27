import { roundMoney } from './format'
import { weekStart } from './pricing'
import type { DayCalculation, Unit } from './types'

export type Period = 'day' | 'week' | 'month'

export interface PeriodSummary {
  key: string
  days: number
  studentDays: number
  total: number
  costPerChild: number | null
}

export interface IngredientSummary {
  ingredientId: string
  ingredientName: string
  unit: Unit
  quantity: number
  cost: number
}

export interface RecipeSummary {
  recipeId: string
  name: string
  timesServed: number
  cost: number
}

function periodKey(menuDate: string, period: Period): string {
  if (period === 'day') return menuDate
  if (period === 'week') return weekStart(menuDate)
  return menuDate.slice(0, 7)
}

function roundQuantity(quantity: number): number {
  return Math.round((quantity + Number.EPSILON) * 1000) / 1000
}

/**
 * Groups finalized day snapshots by day, week (Monday key) or month
 * (`YYYY-MM`). `costPerChild` is the period total divided by student-days.
 */
export function summarizeByPeriod(
  snapshots: DayCalculation[],
  period: Period,
): PeriodSummary[] {
  const groups = new Map<string, { days: number; studentDays: number; total: number }>()

  for (const snapshot of snapshots) {
    const key = periodKey(snapshot.menuDate, period)
    const group = groups.get(key) ?? { days: 0, studentDays: 0, total: 0 }
    group.days += 1
    group.studentDays += snapshot.studentCount
    group.total += snapshot.total
    groups.set(key, group)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, group]) => {
      const total = roundMoney(group.total)
      return {
        key,
        days: group.days,
        studentDays: group.studentDays,
        total,
        costPerChild:
          group.studentDays > 0 ? roundMoney(total / group.studentDays) : null,
      }
    })
}

/** Adds up the quantity and cost of every ingredient across snapshots. */
export function summarizeByIngredient(snapshots: DayCalculation[]): IngredientSummary[] {
  const groups = new Map<string, IngredientSummary>()

  for (const snapshot of snapshots) {
    for (const recipe of snapshot.recipes) {
      for (const line of recipe.lines) {
        const group = groups.get(line.ingredientId) ?? {
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          unit: line.unit,
          quantity: 0,
          cost: 0,
        }
        group.quantity += line.scaledQuantity
        group.cost += line.cost ?? 0
        groups.set(line.ingredientId, group)
      }
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      quantity: roundQuantity(group.quantity),
      cost: roundMoney(group.cost),
    }))
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName))
}

/** Counts how often each recipe was served and sums its cost. */
export function summarizeByRecipe(snapshots: DayCalculation[]): RecipeSummary[] {
  const groups = new Map<string, RecipeSummary>()

  for (const snapshot of snapshots) {
    for (const recipe of snapshot.recipes) {
      const group = groups.get(recipe.recipeId) ?? {
        recipeId: recipe.recipeId,
        name: recipe.name,
        timesServed: 0,
        cost: 0,
      }
      group.timesServed += 1
      group.cost += recipe.cost
      groups.set(recipe.recipeId, group)
    }
  }

  return [...groups.values()]
    .map((group) => ({ ...group, cost: roundMoney(group.cost) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
