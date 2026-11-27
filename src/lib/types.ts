export type Unit = 'Kg' | 'Gram' | 'Liter' | 'Millilitre' | 'Each'

export type IngredientCategory = 'fixed' | 'grocery' | 'vegetable' | 'snacks'

export interface Ingredient {
  id: string
  name: string
  unit: Unit
  category?: IngredientCategory
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
  receiptId?: string | null
  receiptPath?: string | null
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

export interface FixedBill {
  id: string
  monthlyBudgetId: string
  label: string
  billDate: string
  amount: number
  notes?: string | null
  receiptId?: string | null
  receiptPath?: string | null
}

export interface WeeklyBillAllocation {
  id: string
  monthlyBudgetId: string
  weekStart: string
  groceryBill: number
  vegetableBill: number
  snacksBill: number
  notes?: string | null
}

export interface MonthlyBudget {
  id: string
  month: string
  siteAmount: number | null
  plannedTarget: number
  notes?: string | null
}

export interface BudgetReconciliation {
  plannedTarget: number
  totalFixed: number
  distributableBudget: number
  totalGrocery: number
  totalVegetable: number
  totalSnacks: number
  totalWeeklyAllocated: number
  totalPlanned: number
  remainingToAllocate: number
}

export interface WeekIngredientItem {
  ingredientId: string
  ingredientName: string
  category: IngredientCategory
  unit: Unit
  totalQuantity: number
  estimatedCost: number | null
  hasMissingPrice: boolean
}

export interface WeekDayMenuSummary {
  menuDate: string
  weekday: string
  studentCount: number
  recipeNames: string[]
}

export interface WeekMenuBreakdown {
  weekStart: string
  weekEnd: string
  days: WeekDayMenuSummary[]
  vegetables: WeekIngredientItem[]
  groceries: WeekIngredientItem[]
  snacks: WeekIngredientItem[]
  estimatedVegetableCost: number
  estimatedGroceryCost: number
  estimatedSnacksCost: number
}

export type ReceiptTargetType = 'purchase' | 'fixed_bill' | 'mixed'
export type ReceiptItemDestination = 'purchase' | 'fixed_bill'

export interface ParsedReceiptItem {
  id: string
  rawName: string
  matchedIngredientId: string
  matchedIngredientName: string | null
  destination: ReceiptItemDestination
  category: IngredientCategory
  quantity: number
  unit: Unit
  totalPrice: number
}

export interface ParsedReceipt {
  supplier: string
  billNumber: string
  billDate: string
  totalAmount: number | null
  items: ParsedReceiptItem[]
}
