import { errorMessage, requireSupabase } from './supabase'
import type { Ingredient, IngredientCategory, Unit } from '../lib/types'

interface IngredientRow {
  id: string
  name: string
  unit: Unit
  category: IngredientCategory
  description: string | null
  active: boolean
}

export interface SaveIngredientInput {
  id?: string
  name: string
  unit: Unit
  category?: IngredientCategory
  description?: string
  active: boolean
}

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    category: row.category ?? 'grocery',
    description: row.description,
    active: row.active,
  }
}

export async function listIngredients(): Promise<Ingredient[]> {
  const { data, error } = await requireSupabase()
    .from('ingredients')
    .select('id, name, unit, category, description, active')
    .order('name', { ascending: true })

  if (error) throw new Error(errorMessage(error))
  return (data as IngredientRow[]).map(mapIngredient)
}

export async function saveIngredient(input: SaveIngredientInput): Promise<Ingredient> {
  const client = requireSupabase()
  const payload = {
    name: input.name.trim(),
    unit: input.unit,
    category: input.category ?? 'grocery',
    description: input.description?.trim() || null,
    active: input.active,
  }

  const query = input.id
    ? client.from('ingredients').update(payload).eq('id', input.id)
    : client.from('ingredients').insert(payload)

  const { data, error } = await query
    .select('id, name, unit, category, description, active')
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapIngredient(data as IngredientRow)
}
