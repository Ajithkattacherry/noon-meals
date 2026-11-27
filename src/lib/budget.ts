import { computeDay } from './costing'
import { roundMoney } from './format'
import { weekStart } from './pricing'
import type {
  BudgetReconciliation,
  DailyMenu,
  FixedBill,
  Ingredient,
  IngredientCategory,
  Purchase,
  Recipe,
  WeekDayMenuSummary,
  WeekIngredientItem,
  WeekMenuBreakdown,
  WeeklyBillAllocation,
} from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return WEEKDAYS[date.getUTCDay()] ?? ''
}

function roundQuantity(quantity: number, unit: string): number {
  if (unit === 'Each') return Math.round(quantity)
  return Math.round((quantity + Number.EPSILON) * 1000) / 1000
}

/**
 * Returns the Monday `YYYY-MM-DD` start dates for every Mon–Fri week that
 * has at least one weekday inside `month` (`YYYY-MM`).
 */
export function weeksInMonth(month: string): string[] {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const seen = new Set<string>()
  const weeks: string[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${pad(monthNum)}-${pad(day)}`
    const utcDay = new Date(Date.UTC(year, monthNum - 1, day)).getUTCDay()
    if (utcDay === 0 || utcDay === 6) continue
    const monday = weekStart(iso)
    if (!seen.has(monday)) {
      seen.add(monday)
      weeks.push(monday)
    }
  }

  return weeks
}

/**
 * Computes monthly budget totals, fixed-bill deductions, weekly allocations,
 * and remaining variance against `plannedTarget`.
 */
export function reconcileMonthlyBudget(
  plannedTarget: number,
  fixedBills: FixedBill[],
  weeklyAllocations: WeeklyBillAllocation[],
): BudgetReconciliation {
  const totalFixed = roundMoney(
    fixedBills.reduce((sum, bill) => sum + (Number.isFinite(bill.amount) ? bill.amount : 0), 0),
  )
  const distributableBudget = roundMoney(plannedTarget - totalFixed)

  let grocery = 0
  let vegetable = 0
  let snacks = 0

  for (const alloc of weeklyAllocations) {
    grocery += Number.isFinite(alloc.groceryBill) ? alloc.groceryBill : 0
    vegetable += Number.isFinite(alloc.vegetableBill) ? alloc.vegetableBill : 0
    snacks += Number.isFinite(alloc.snacksBill) ? alloc.snacksBill : 0
  }

  const totalGrocery = roundMoney(grocery)
  const totalVegetable = roundMoney(vegetable)
  const totalSnacks = roundMoney(snacks)
  const totalWeeklyAllocated = roundMoney(totalGrocery + totalVegetable + totalSnacks)
  const totalPlanned = roundMoney(totalFixed + totalWeeklyAllocated)
  const remainingToAllocate = roundMoney(plannedTarget - totalPlanned)

  return {
    plannedTarget: roundMoney(plannedTarget),
    totalFixed,
    distributableBudget,
    totalGrocery,
    totalVegetable,
    totalSnacks,
    totalWeeklyAllocated,
    totalPlanned,
    remainingToAllocate,
  }
}

/**
 * Aggregates Monday–Friday menus for `weekStartIso` (Monday `YYYY-MM-DD`)
 * into categorized vegetable, grocery, and snacks ingredient lists with
 * estimated costs from applicable purchases.
 */
export function summarizeWeekIngredients(
  menus: DailyMenu[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  purchases: Purchase[],
  weekStartIso: string,
): WeekMenuBreakdown {
  const weekEnd = addDays(weekStartIso, 4) // Friday
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]))

  const weekMenus = menus
    .filter((menu) => menu.menuDate >= weekStartIso && menu.menuDate <= weekEnd)
    .sort((a, b) => (a.menuDate < b.menuDate ? -1 : a.menuDate > b.menuDate ? 1 : 0))

  const days: WeekDayMenuSummary[] = []
  const byIngredient = new Map<
    string,
    {
      ingredientId: string
      ingredientName: string
      category: IngredientCategory
      unit: Ingredient['unit']
      totalQuantity: number
      estimatedCost: number
      hasCost: boolean
      hasMissingPrice: boolean
    }
  >()

  for (const menu of weekMenus) {
    const selectedRecipes = menu.recipeIds
      .map((id) => recipeById.get(id))
      .filter((recipe): recipe is Recipe => Boolean(recipe))

    days.push({
      menuDate: menu.menuDate,
      weekday: weekdayLabel(menu.menuDate),
      studentCount: menu.studentCount,
      recipeNames: selectedRecipes.map((recipe) => recipe.name),
    })

    const calc =
      menu.status === 'finalized' && menu.snapshot
        ? menu.snapshot
        : computeDay({
            menuDate: menu.menuDate,
            studentCount: menu.studentCount,
            bufferPercent: menu.bufferPercent,
            recipes: selectedRecipes,
            ingredients,
            purchases,
            overrides: menu.overrides,
          })

    for (const recipe of calc.recipes) {
      for (const line of recipe.lines) {
        const ingredient = ingredientById.get(line.ingredientId)
        const category: IngredientCategory = ingredient?.category ?? 'grocery'
        if (category === 'fixed') continue

        const existing = byIngredient.get(line.ingredientId) ?? {
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          category,
          unit: line.unit,
          totalQuantity: 0,
          estimatedCost: 0,
          hasCost: false,
          hasMissingPrice: false,
        }

        existing.totalQuantity = roundQuantity(
          existing.totalQuantity + line.scaledQuantity,
          line.unit,
        )
        if (line.cost === null) {
          existing.hasMissingPrice = true
        } else {
          existing.estimatedCost = roundMoney(existing.estimatedCost + line.cost)
          existing.hasCost = true
        }

        byIngredient.set(line.ingredientId, existing)
      }
    }
  }

  const vegetables: WeekIngredientItem[] = []
  const groceries: WeekIngredientItem[] = []
  const snacks: WeekIngredientItem[] = []

  const sorted = Array.from(byIngredient.values()).sort((a, b) =>
    a.ingredientName.localeCompare(b.ingredientName),
  )

  for (const item of sorted) {
    const entry: WeekIngredientItem = {
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      category: item.category,
      unit: item.unit,
      totalQuantity: item.totalQuantity,
      estimatedCost: item.hasCost ? item.estimatedCost : null,
      hasMissingPrice: item.hasMissingPrice,
    }
    if (item.category === 'vegetable') vegetables.push(entry)
    else if (item.category === 'snacks') snacks.push(entry)
    else groceries.push(entry)
  }

  const sumCost = (items: WeekIngredientItem[]) =>
    roundMoney(items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0))

  return {
    weekStart: weekStartIso,
    weekEnd,
    days,
    vegetables,
    groceries,
    snacks,
    estimatedVegetableCost: sumCost(vegetables),
    estimatedGroceryCost: sumCost(groceries),
    estimatedSnacksCost: sumCost(snacks),
  }
}
