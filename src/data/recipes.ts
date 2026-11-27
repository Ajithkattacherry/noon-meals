import { errorMessage, requireSupabase } from './supabase'
import type { Recipe, RecipeItem, Unit } from '../lib/types'

interface RecipeItemRow {
  ingredient_id: string
  quantity: number
  unit: Unit
}

interface RecipeRow {
  id: string
  name: string
  base_servings: number
  active: boolean
  recipe_items: RecipeItemRow[] | null
}

export interface SaveRecipeInput {
  id?: string
  name: string
  baseServings: number
  items: RecipeItem[]
  active: boolean
}

const RECIPE_COLUMNS = 'id, name, base_servings, active, recipe_items(ingredient_id, quantity, unit)'

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    baseServings: row.base_servings,
    active: row.active,
    items: (row.recipe_items ?? []).map((item) => ({
      ingredientId: item.ingredient_id,
      quantity: Number(item.quantity),
      unit: item.unit,
    })),
  }
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await requireSupabase()
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .order('name', { ascending: true })

  if (error) throw new Error(errorMessage(error))
  return (data as RecipeRow[]).map(mapRecipe)
}

export async function getRecipe(id: string): Promise<Recipe> {
  const { data, error } = await requireSupabase()
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapRecipe(data as RecipeRow)
}

/** Saves the recipe and replaces its item set in one database transaction. */
export async function saveRecipe(input: SaveRecipeInput): Promise<Recipe> {
  const { data, error } = await requireSupabase().rpc('save_recipe', {
    p_id: input.id ?? null,
    p_name: input.name.trim(),
    p_base_servings: input.baseServings,
    p_items: input.items.map((item) => ({
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
    })),
    p_active: input.active,
  })

  if (error) throw new Error(errorMessage(error))
  return getRecipe(data as string)
}
