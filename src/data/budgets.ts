import { errorMessage, requireSupabase } from './supabase'
import type {
  FixedBill,
  MonthlyBudget,
  WeeklyBillAllocation,
} from '../lib/types'

interface MonthlyBudgetRow {
  id: string
  month: string
  site_amount: number | null
  planned_target: number
  notes: string | null
}

interface FixedBillRow {
  id: string
  monthly_budget_id: string
  label: string
  bill_date: string
  amount: number
  notes: string | null
  receipt_id: string | null
  receipt_path: string | null
}

interface WeeklyAllocationRow {
  id: string
  monthly_budget_id: string
  week_start: string
  grocery_bill: number
  vegetable_bill: number
  snacks_bill: number
  notes: string | null
}

export interface MonthlyBudgetBundle {
  budget: MonthlyBudget | null
  fixedBills: FixedBill[]
  weeklyAllocations: WeeklyBillAllocation[]
}

function mapBudget(row: MonthlyBudgetRow): MonthlyBudget {
  return {
    id: row.id,
    month: row.month,
    siteAmount: row.site_amount === null ? null : Number(row.site_amount),
    plannedTarget: Number(row.planned_target),
    notes: row.notes,
  }
}

function mapFixedBill(row: FixedBillRow): FixedBill {
  return {
    id: row.id,
    monthlyBudgetId: row.monthly_budget_id,
    label: row.label,
    billDate: row.bill_date,
    amount: Number(row.amount),
    notes: row.notes,
    receiptId: row.receipt_id,
    receiptPath: row.receipt_path,
  }
}

function mapWeeklyAllocation(row: WeeklyAllocationRow): WeeklyBillAllocation {
  return {
    id: row.id,
    monthlyBudgetId: row.monthly_budget_id,
    weekStart: row.week_start,
    groceryBill: Number(row.grocery_bill),
    vegetableBill: Number(row.vegetable_bill),
    snacksBill: Number(row.snacks_bill),
    notes: row.notes,
  }
}

export async function getMonthlyBudget(month: string): Promise<MonthlyBudgetBundle> {
  const client = requireSupabase()
  const { data: budgetRow, error: budgetError } = await client
    .from('monthly_budgets')
    .select('id, month, site_amount, planned_target, notes')
    .eq('month', month)
    .maybeSingle()

  if (budgetError) throw new Error(errorMessage(budgetError))
  if (!budgetRow) {
    return { budget: null, fixedBills: [], weeklyAllocations: [] }
  }

  const budget = mapBudget(budgetRow as MonthlyBudgetRow)

  const [{ data: bills, error: billsError }, { data: weeks, error: weeksError }] =
    await Promise.all([
      client
        .from('monthly_fixed_bills')
        .select('id, monthly_budget_id, label, bill_date, amount, notes, receipt_id, receipt_path')
        .eq('monthly_budget_id', budget.id)
        .order('bill_date', { ascending: true }),
      client
        .from('weekly_bill_allocations')
        .select(
          'id, monthly_budget_id, week_start, grocery_bill, vegetable_bill, snacks_bill, notes',
        )
        .eq('monthly_budget_id', budget.id)
        .order('week_start', { ascending: true }),
    ])

  if (billsError) throw new Error(errorMessage(billsError))
  if (weeksError) throw new Error(errorMessage(weeksError))

  return {
    budget,
    fixedBills: (bills as FixedBillRow[]).map(mapFixedBill),
    weeklyAllocations: (weeks as WeeklyAllocationRow[]).map(mapWeeklyAllocation),
  }
}

export async function saveMonthlyBudgetTarget(input: {
  month: string
  siteAmount: number | null
  plannedTarget: number
  notes?: string
}): Promise<MonthlyBudget> {
  const { data, error } = await requireSupabase()
    .from('monthly_budgets')
    .upsert(
      {
        month: input.month,
        site_amount: input.siteAmount,
        planned_target: input.plannedTarget,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month' },
    )
    .select('id, month, site_amount, planned_target, notes')
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapBudget(data as MonthlyBudgetRow)
}

export async function saveFixedBill(input: {
  id?: string
  monthlyBudgetId: string
  label: string
  billDate: string
  amount: number
  notes?: string
  receiptId?: string | null
  receiptPath?: string | null
}): Promise<FixedBill> {
  const client = requireSupabase()
  const payload = {
    monthly_budget_id: input.monthlyBudgetId,
    label: input.label.trim(),
    bill_date: input.billDate,
    amount: input.amount,
    notes: input.notes?.trim() || null,
    ...(input.receiptId !== undefined ? { receipt_id: input.receiptId } : {}),
    ...(input.receiptPath !== undefined ? { receipt_path: input.receiptPath } : {}),
  }

  const query = input.id
    ? client.from('monthly_fixed_bills').update(payload).eq('id', input.id)
    : client.from('monthly_fixed_bills').insert(payload)

  const { data, error } = await query
    .select('id, monthly_budget_id, label, bill_date, amount, notes, receipt_id, receipt_path')
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapFixedBill(data as FixedBillRow)
}

export async function deleteFixedBill(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('monthly_fixed_bills')
    .delete()
    .eq('id', id)

  if (error) throw new Error(errorMessage(error))
}

export async function saveWeeklyAllocation(input: {
  monthlyBudgetId: string
  weekStart: string
  groceryBill: number
  vegetableBill: number
  snacksBill: number
  notes?: string
}): Promise<WeeklyBillAllocation> {
  const { data, error } = await requireSupabase()
    .from('weekly_bill_allocations')
    .upsert(
      {
        monthly_budget_id: input.monthlyBudgetId,
        week_start: input.weekStart,
        grocery_bill: input.groceryBill,
        vegetable_bill: input.vegetableBill,
        snacks_bill: input.snacksBill,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'monthly_budget_id,week_start' },
    )
    .select(
      'id, monthly_budget_id, week_start, grocery_bill, vegetable_bill, snacks_bill, notes',
    )
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapWeeklyAllocation(data as WeeklyAllocationRow)
}
