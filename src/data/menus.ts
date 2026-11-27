import { errorMessage, requireSupabase } from './supabase'
import type { DailyMenu, DayCalculation, MenuStatus } from '../lib/types'

interface MenuRow {
  id: string
  menu_date: string
  student_count: number
  buffer_percent: number
  overrides: Record<string, number> | null
  status: MenuStatus
  snapshot: DayCalculation | null
  finalized_at: string | null
  daily_menu_recipes: { recipe_id: string }[] | null
}

export interface SaveDraftMenuInput {
  menuDate: string
  studentCount: number
  bufferPercent: number
  recipeIds: string[]
  overrides: Record<string, number>
}

export interface MenuSummary {
  id: string
  menuDate: string
  studentCount: number
  status: MenuStatus
}

const MENU_COLUMNS =
  'id, menu_date, student_count, buffer_percent, overrides, status, snapshot, finalized_at, daily_menu_recipes(recipe_id)'

function mapMenu(row: MenuRow): DailyMenu {
  return {
    id: row.id,
    menuDate: row.menu_date,
    studentCount: row.student_count,
    bufferPercent: Number(row.buffer_percent),
    overrides: row.overrides ?? {},
    status: row.status,
    snapshot: row.snapshot,
    finalizedAt: row.finalized_at,
    recipeIds: (row.daily_menu_recipes ?? []).map((link) => link.recipe_id),
  }
}

export async function getMenuByDate(menuDate: string): Promise<DailyMenu | null> {
  const { data, error } = await requireSupabase()
    .from('daily_menus')
    .select(MENU_COLUMNS)
    .eq('menu_date', menuDate)
    .maybeSingle()

  if (error) throw new Error(errorMessage(error))
  return data ? mapMenu(data as MenuRow) : null
}

export async function listMenus(): Promise<MenuSummary[]> {
  const { data, error } = await requireSupabase()
    .from('daily_menus')
    .select('id, menu_date, student_count, status')
    .order('menu_date', { ascending: true })

  if (error) throw new Error(errorMessage(error))
  return (data as {
    id: string
    menu_date: string
    student_count: number
    status: MenuStatus
  }[]).map((row) => ({
    id: row.id,
    menuDate: row.menu_date,
    studentCount: row.student_count,
    status: row.status,
  }))
}

/** Creates or updates the draft for a date in one transaction. */
export async function saveDraftMenu(input: SaveDraftMenuInput): Promise<DailyMenu> {
  const { error } = await requireSupabase().rpc('save_draft_menu', {
    p_menu_date: input.menuDate,
    p_student_count: input.studentCount,
    p_buffer_percent: input.bufferPercent,
    p_recipe_ids: input.recipeIds,
    p_overrides: input.overrides,
  })

  if (error) throw new Error(errorMessage(error))

  const menu = await getMenuByDate(input.menuDate)
  if (!menu) throw new Error('The draft menu could not be loaded after saving.')
  return menu
}

export async function finalizeMenu(
  menuDate: string,
  calc: DayCalculation,
): Promise<void> {
  const { error } = await requireSupabase().rpc('finalize_menu', {
    p_menu_date: menuDate,
    p_snapshot: calc,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function reopenMenu(menuDate: string, reason: string): Promise<void> {
  if (!reason.trim()) {
    throw new Error('A reason is required to reopen a finalized day.')
  }

  const { error } = await requireSupabase().rpc('reopen_menu', {
    p_menu_date: menuDate,
    p_reason: reason.trim(),
  })

  if (error) throw new Error(errorMessage(error))
}

/** Finalized snapshots only; reports never read live data. */
export async function listFinalizedMenus(
  from?: string,
  to?: string,
): Promise<DayCalculation[]> {
  let query = requireSupabase()
    .from('daily_menus')
    .select('snapshot')
    .eq('status', 'finalized')
    .not('snapshot', 'is', null)

  if (from) query = query.gte('menu_date', from)
  if (to) query = query.lte('menu_date', to)

  const { data, error } = await query.order('menu_date', { ascending: true })

  if (error) throw new Error(errorMessage(error))
  return (data as { snapshot: DayCalculation }[]).map((row) => row.snapshot)
}
