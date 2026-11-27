export type Unit = 'Kg' | 'Gram' | 'Liter' | 'Millilitre' | 'Each'

export interface Ingredient {
  id: string
  name: string
  unit: Unit
  description?: string | null
  active?: boolean
}

export interface Purchase {
  id: string
  ingredientId: string
  purchaseDate: string
  /** Unit price in INR for the ingredient's own unit. */
  unitPrice: number
  createdAt: string
  quantity?: number
  totalPrice?: number
  supplier?: string | null
  notes?: string | null
}

export interface RecipeItem {
  ingredientId: string
  quantity: number
  unit: Unit
}

export interface Recipe {
  id: string
  name: string
  baseServings: number
  items: RecipeItem[]
  active?: boolean
}

export interface PriceRef {
  purchaseId: string
  purchaseDate: string
  unitPrice: number
  carriedOver: boolean
}

export type FlagKind = 'missing_price' | 'unit_mismatch'

export type Flag = {
  kind: FlagKind
  recipeId: string
  ingredientId: string
}

export interface CostLine {
  recipeId: string
  ingredientId: string
  ingredientName: string
  unit: Unit
  baseQuantity: number
  scaledQuantity: number
  overridden: boolean
  price: PriceRef | null
  cost: number | null
}

export interface RecipeCost {
  recipeId: string
  name: string
  baseServings: number
  lines: CostLine[]
  cost: number
}

export interface DayCalculation {
  menuDate: string
  studentCount: number
  bufferPercent: number
  recipes: RecipeCost[]
  flags: Flag[]
  total: number
  complete: boolean
  costPerChild: number | null
}

export type MenuStatus = 'draft' | 'finalized'

export interface DailyMenu {
  id: string
  menuDate: string
  studentCount: number
  bufferPercent: number
  recipeIds: string[]
  overrides: Record<string, number>
  status: MenuStatus
  snapshot: DayCalculation | null
  finalizedAt: string | null
}

/** Key used for a per-line quantity override. */
export function overrideKey(recipeId: string, ingredientId: string): string {
  return `${recipeId}:${ingredientId}`
}
