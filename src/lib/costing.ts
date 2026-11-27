import { findApplicablePrice } from './pricing'
import { roundMoney } from './format'
import { scaleQuantity } from './scaling'
import { convertQuantity } from './units'
import { overrideKey } from './types'
import type {
  CostLine,
  DayCalculation,
  Flag,
  Ingredient,
  Purchase,
  Recipe,
  RecipeCost,
} from './types'

export interface ComputeDayInput {
  menuDate: string
  studentCount: number
  bufferPercent: number
  recipes: Recipe[]
  ingredients: Ingredient[]
  purchases: Purchase[]
  /** Key is `${recipeId}:${ingredientId}`; value is the final scaled quantity. */
  overrides?: Record<string, number>
}

/**
 * Computes the whole day's cost. Missing prices and incompatible units are
 * flagged and their lines get a `null` cost; the day total only sums priced
 * lines and the day is `complete` only when nothing is flagged.
 */
export function computeDay(input: ComputeDayInput): DayCalculation {
  const {
    menuDate,
    studentCount,
    bufferPercent,
    recipes,
    ingredients,
    purchases,
    overrides = {},
  } = input
  const flags: Flag[] = []

  const recipeCosts: RecipeCost[] = recipes.map((recipe) => {
    const lines: CostLine[] = recipe.items.map((item) => {
      const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId)
      const rawOverride = overrides[overrideKey(recipe.id, item.ingredientId)]
      const hasOverride = typeof rawOverride === 'number' && Number.isFinite(rawOverride)

      if (!ingredient) {
        flags.push({
          kind: 'missing_price',
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
        })
        return {
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
          ingredientName: 'Unknown ingredient',
          unit: item.unit,
          baseQuantity: 0,
          scaledQuantity: hasOverride ? Math.max(0, rawOverride) : 0,
          overridden: hasOverride,
          price: null,
          cost: null,
        }
      }

      const baseQuantity = convertQuantity(item.quantity, item.unit, ingredient.unit)

      if (baseQuantity === null) {
        flags.push({
          kind: 'unit_mismatch',
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
        })
        return {
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          unit: ingredient.unit,
          baseQuantity: 0,
          scaledQuantity: hasOverride ? Math.max(0, rawOverride) : 0,
          overridden: hasOverride,
          price: null,
          cost: null,
        }
      }

      const scaledQuantity = hasOverride
        ? Math.max(0, rawOverride)
        : scaleQuantity(
            baseQuantity,
            studentCount,
            recipe.baseServings,
            bufferPercent,
            ingredient.unit,
          )

      const price = findApplicablePrice(purchases, ingredient.id, menuDate)
      if (!price) {
        flags.push({
          kind: 'missing_price',
          recipeId: recipe.id,
          ingredientId: ingredient.id,
        })
        return {
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          unit: ingredient.unit,
          baseQuantity,
          scaledQuantity,
          overridden: hasOverride,
          price: null,
          cost: null,
        }
      }

      return {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        baseQuantity,
        scaledQuantity,
        overridden: hasOverride,
        price,
        cost: roundMoney(scaledQuantity * price.unitPrice),
      }
    })

    const cost = roundMoney(
      lines.reduce((sum, line) => sum + (line.cost === null ? 0 : line.cost), 0),
    )

    return {
      recipeId: recipe.id,
      name: recipe.name,
      baseServings: recipe.baseServings,
      lines,
      cost,
    }
  })

  const total = roundMoney(recipeCosts.reduce((sum, recipe) => sum + recipe.cost, 0))
  const complete = flags.length === 0
  const costPerChild =
    studentCount > 0 && complete ? roundMoney(total / studentCount) : null

  return {
    menuDate,
    studentCount,
    bufferPercent,
    recipes: recipeCosts,
    flags,
    total,
    complete,
    costPerChild,
  }
}
