import { useEffect, useMemo, useState } from 'react'
import {
  deleteFixedBill,
  getMonthlyBudget,
  saveFixedBill,
  saveMonthlyBudgetTarget,
  saveWeeklyAllocation,
} from '../data/budgets'
import { listIngredients } from '../data/ingredients'
import { listMenusInRange } from '../data/menus'
import { listPurchases } from '../data/purchases'
import { listRecipes } from '../data/recipes'
import { getReceiptSignedUrl } from '../data/receipts'
import ReceiptScanner from '../components/ReceiptScanner'
import {
  reconcileMonthlyBudget,
  summarizeWeekIngredients,
  weeksInMonth,
} from '../lib/budget'
import { formatDate, formatINR, formatQuantity, todayISO } from '../lib/format'
import type {
  DailyMenu,
  FixedBill,
  Ingredient,
  MonthlyBudget,
  Purchase,
  Recipe,
  WeekIngredientItem,
  WeeklyBillAllocation,
} from '../lib/types'

interface WeekDraft {
  groceryBill: string
  vegetableBill: string
  snacksBill: string
  notes: string
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function CategoryList({
  title,
  items,
  estimated,
}: {
  title: string
  items: WeekIngredientItem[]
  estimated: number
}) {
  return (
    <div className="kpi" style={{ background: '#fff' }}>
      <div className="card-header" style={{ marginBottom: 8 }}>
        <strong>{title}</strong>
        <span className="badge">{formatINR(estimated)} est.</span>
      </div>
      {items.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          No items from this week’s menu.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.86rem' }}>
          {items.map((item) => (
            <li key={item.ingredientId}>
              <span>{item.ingredientName}</span> —{' '}
              <strong>{formatQuantity(item.totalQuantity, item.unit)}</strong>{' '}
              <span className="muted">
                ({item.estimatedCost !== null ? formatINR(item.estimatedCost) : 'no price'})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function BudgetPlanner() {
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [fixedBills, setFixedBills] = useState<FixedBill[]>([])
  const [allocations, setAllocations] = useState<WeeklyBillAllocation[]>([])
  const [menus, setMenus] = useState<DailyMenu[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])

  const [siteAmount, setSiteAmount] = useState('')
  const [plannedTarget, setPlannedTarget] = useState('')
  const [budgetNotes, setBudgetNotes] = useState('')

  const [billLabel, setBillLabel] = useState('')
  const [billDate, setBillDate] = useState(today)
  const [billAmount, setBillAmount] = useState('')
  const [billNotes, setBillNotes] = useState('')
  const [billError, setBillError] = useState<string | null>(null)

  const [weekDrafts, setWeekDrafts] = useState<Record<string, WeekDraft>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [savingTarget, setSavingTarget] = useState(false)
  const [savingBill, setSavingBill] = useState(false)
  const [savingWeek, setSavingWeek] = useState<string | null>(null)

  const weeks = useMemo(() => weeksInMonth(month), [month])

  async function load(targetMonth: string) {
    setLoading(true)
    setError(null)
    setStatusMessage(null)

    const monthWeeks = weeksInMonth(targetMonth)
    const rangeFrom = monthWeeks[0] ?? `${targetMonth}-01`
    const lastWeek = monthWeeks[monthWeeks.length - 1] ?? `${targetMonth}-28`
    const rangeTo = addDays(lastWeek, 4)

    try {
      const [bundle, nextMenus, nextRecipes, nextIngredients, nextPurchases] =
        await Promise.all([
          getMonthlyBudget(targetMonth),
          listMenusInRange(rangeFrom, rangeTo),
          listRecipes(),
          listIngredients(),
          listPurchases(),
        ])

      setBudget(bundle.budget)
      setFixedBills(bundle.fixedBills)
      setAllocations(bundle.weeklyAllocations)
      setMenus(nextMenus)
      setRecipes(nextRecipes)
      setIngredients(nextIngredients)
      setPurchases(nextPurchases)

      setSiteAmount(
        bundle.budget?.siteAmount !== null && bundle.budget?.siteAmount !== undefined
          ? String(bundle.budget.siteAmount)
          : '',
      )
      setPlannedTarget(
        bundle.budget ? String(bundle.budget.plannedTarget) : '',
      )
      setBudgetNotes(bundle.budget?.notes ?? '')

      const drafts: Record<string, WeekDraft> = {}
      for (const week of monthWeeks) {
        const existing = bundle.weeklyAllocations.find((a) => a.weekStart === week)
        drafts[week] = {
          groceryBill: existing ? String(existing.groceryBill) : '0',
          vegetableBill: existing ? String(existing.vegetableBill) : '0',
          snacksBill: existing ? String(existing.snacksBill) : '0',
          notes: existing?.notes ?? '',
        }
      }
      setWeekDrafts(drafts)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load budget planner.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(month)
  }, [month])

  const liveAllocations = useMemo<WeeklyBillAllocation[]>(() => {
    return weeks.map((week) => {
      const draft = weekDrafts[week]
      return {
        id: allocations.find((a) => a.weekStart === week)?.id ?? week,
        monthlyBudgetId: budget?.id ?? '',
        weekStart: week,
        groceryBill: Number(draft?.groceryBill) || 0,
        vegetableBill: Number(draft?.vegetableBill) || 0,
        snacksBill: Number(draft?.snacksBill) || 0,
        notes: draft?.notes ?? '',
      }
    })
  }, [weeks, weekDrafts, allocations, budget])

  const targetNum = Number(plannedTarget) || 0
  const reconciliation = useMemo(
    () => reconcileMonthlyBudget(targetNum, fixedBills, liveAllocations),
    [targetNum, fixedBills, liveAllocations],
  )

  const weekBreakdowns = useMemo(() => {
    return weeks.map((week) =>
      summarizeWeekIngredients(menus, recipes, ingredients, purchases, week),
    )
  }, [weeks, menus, recipes, ingredients, purchases])

  async function handleSaveTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setStatusMessage(null)

    const target = Number(plannedTarget)
    if (!Number.isFinite(target) || target < 0) {
      setError('Enter a valid non-negative planned target amount.')
      return
    }

    const site = siteAmount.trim() === '' ? null : Number(siteAmount)
    if (site !== null && (!Number.isFinite(site) || site < 0)) {
      setError('Site reference amount must be zero or positive.')
      return
    }

    setSavingTarget(true)
    try {
      const saved = await saveMonthlyBudgetTarget({
        month,
        siteAmount: site,
        plannedTarget: target,
        notes: budgetNotes,
      })
      setBudget(saved)
      setStatusMessage('Monthly target saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save monthly target.')
    } finally {
      setSavingTarget(false)
    }
  }

  async function handleAddBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBillError(null)
    setStatusMessage(null)

    if (!budget) {
      setBillError('Save the monthly target first before adding fixed bills.')
      return
    }
    if (!billLabel.trim()) {
      setBillError('Enter a bill label (for example Rice, Transportation, or Gas).')
      return
    }
    const amount = Number(billAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setBillError('Enter a valid non-negative bill amount.')
      return
    }

    setSavingBill(true)
    try {
      const created = await saveFixedBill({
        monthlyBudgetId: budget.id,
        label: billLabel,
        billDate,
        amount,
        notes: billNotes,
      })
      setFixedBills((prev) => [...prev, created])
      setBillLabel('')
      setBillAmount('')
      setBillNotes('')
      setStatusMessage('Fixed bill added.')
    } catch (caught) {
      setBillError(caught instanceof Error ? caught.message : 'Could not save fixed bill.')
    } finally {
      setSavingBill(false)
    }
  }

  async function handleDeleteBill(id: string) {
    setError(null)
    setStatusMessage(null)
    try {
      await deleteFixedBill(id)
      setFixedBills((prev) => prev.filter((b) => b.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete fixed bill.')
    }
  }

  function updateWeekDraft(week: string, patch: Partial<WeekDraft>) {
    setWeekDrafts((prev) => ({
      ...prev,
      [week]: {
        ...(prev[week] ?? {
          groceryBill: '0',
          vegetableBill: '0',
          snacksBill: '0',
          notes: '',
        }),
        ...patch,
      },
    }))
  }

  async function handleSaveWeek(week: string) {
    setError(null)
    setStatusMessage(null)
    if (!budget) {
      setError('Save the monthly target first before saving weekly bills.')
      return
    }
    const draft = weekDrafts[week]
    const groceryBill = Number(draft?.groceryBill) || 0
    const vegetableBill = Number(draft?.vegetableBill) || 0
    const snacksBill = Number(draft?.snacksBill) || 0
    if (groceryBill < 0 || vegetableBill < 0 || snacksBill < 0) {
      setError('Weekly bill amounts cannot be negative.')
      return
    }

    setSavingWeek(week)
    try {
      const saved = await saveWeeklyAllocation({
        monthlyBudgetId: budget.id,
        weekStart: week,
        groceryBill,
        vegetableBill,
        snacksBill,
        notes: draft?.notes,
      })
      setAllocations((prev) => {
        const rest = prev.filter((a) => a.weekStart !== week)
        return [...rest, saved]
      })
      setStatusMessage(`Saved bills for week of ${formatDate(week)}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save weekly bills.')
    } finally {
      setSavingWeek(null)
    }
  }

  const varianceBadge =
    reconciliation.plannedTarget > 0 && reconciliation.remainingToAllocate === 0 ? (
      <span className="badge badge-ok">Balanced to target</span>
    ) : reconciliation.remainingToAllocate < 0 ? (
      <span className="badge badge-danger">
        Over by {formatINR(Math.abs(reconciliation.remainingToAllocate))}
      </span>
    ) : (
      <span className="badge badge-warn">
        {formatINR(reconciliation.remainingToAllocate)} remaining
      </span>
    )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Monthly budget &amp; weekly bills</h1>
          <p>
            Set the month-end target figure, deduct fixed bills (Rice, Transportation, Gas), and
            allocate Grocery, Vegetable, and Snacks bills across each Mon–Fri week.
          </p>
        </div>

        <div style={{ minWidth: 180 }}>
          <label htmlFor="budget-month">Month</label>
          <input
            id="budget-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {statusMessage && (
        <p className="success-banner" role="status" style={{ marginBottom: 16 }}>
          {statusMessage}
        </p>
      )}

      {loading ? (
        <div className="card">
          <p className="muted">Loading monthly budget…</p>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="card-header">
              <h2>Monthly target &amp; reconciliation</h2>
              {varianceBadge}
            </div>

            <form onSubmit={handleSaveTarget} className="form-grid" style={{ marginBottom: 16 }}>
              <div>
                <label htmlFor="site-amount">Site amount (reference ₹)</label>
                <input
                  id="site-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={siteAmount}
                  onChange={(event) => setSiteAmount(event.target.value)}
                  placeholder="Optional portal figure"
                />
              </div>

              <div>
                <label htmlFor="planned-target">Planned monthly target (₹)</label>
                <input
                  id="planned-target"
                  type="number"
                  min="0"
                  step="0.01"
                  value={plannedTarget}
                  onChange={(event) => setPlannedTarget(event.target.value)}
                  placeholder="50000"
                />
              </div>

              <div>
                <label htmlFor="budget-notes">Notes (optional)</label>
                <input
                  id="budget-notes"
                  value={budgetNotes}
                  onChange={(event) => setBudgetNotes(event.target.value)}
                  placeholder="November allotment"
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={savingTarget}>
                  {savingTarget ? 'Saving…' : 'Save target'}
                </button>
              </div>
            </form>

            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-label">Planned target</div>
                <div className="kpi-value">{formatINR(reconciliation.plannedTarget)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Fixed bills</div>
                <div className="kpi-value">{formatINR(reconciliation.totalFixed)}</div>
                <div className="kpi-hint">{fixedBills.length} bill(s)</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Distributable balance</div>
                <div className="kpi-value">{formatINR(reconciliation.distributableBudget)}</div>
                <div className="kpi-hint">Target minus fixed bills</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Weekly bills allocated</div>
                <div className="kpi-value">{formatINR(reconciliation.totalWeeklyAllocated)}</div>
                <div className="kpi-hint">
                  Veg {formatINR(reconciliation.totalVegetable)} · Groc{' '}
                  {formatINR(reconciliation.totalGrocery)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Remaining to allocate</div>
                <div className="kpi-value">{formatINR(reconciliation.remainingToAllocate)}</div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Fixed monthly bills (Rice, Transportation, Gas)</h2>
              <span className="badge">{formatINR(reconciliation.totalFixed)}</span>
            </div>

            {!budget && (
              <p className="notice" style={{ marginBottom: 14 }}>
                Save your planned monthly target above to start adding fixed bills and weekly
                allocations.
              </p>
            )}

            <form onSubmit={handleAddBill} className="form-grid" style={{ marginBottom: 16 }}>
              <div>
                <label htmlFor="bill-label">Bill item</label>
                <input
                  id="bill-label"
                  value={billLabel}
                  onChange={(event) => setBillLabel(event.target.value)}
                  placeholder="Rice / Transportation / Gas"
                />
              </div>

              <div>
                <label htmlFor="bill-date">Bill date</label>
                <input
                  id="bill-date"
                  type="date"
                  value={billDate}
                  onChange={(event) => setBillDate(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="bill-amount">Amount (₹)</label>
                <input
                  id="bill-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billAmount}
                  onChange={(event) => setBillAmount(event.target.value)}
                  placeholder="12000"
                />
              </div>

              <div>
                <label htmlFor="bill-notes">Notes (optional)</label>
                <input
                  id="bill-notes"
                  value={billNotes}
                  onChange={(event) => setBillNotes(event.target.value)}
                  placeholder="Monthly bill"
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={savingBill || !budget}>
                  {savingBill ? 'Adding…' : 'Add fixed bill'}
                </button>
              </div>
            </form>

            {billError && (
              <p className="field-error" role="alert" style={{ marginBottom: 12 }}>
                {billError}
              </p>
            )}

            {fixedBills.length === 0 ? (
              <p className="muted">No fixed bills recorded for {month} yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Date</th>
                      <th className="num">Amount</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedBills.map((bill) => (
                      <tr key={bill.id}>
                        <td>
                          <strong>{bill.label}</strong>
                        </td>
                        <td className="nowrap">{formatDate(bill.billDate)}</td>
                        <td className="num">{formatINR(bill.amount)}</td>
                        <td className="muted small">{bill.notes || '—'}</td>
                        <td>
                          <div className="actions">
                            {bill.receiptPath && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  void getReceiptSignedUrl(bill.receiptPath!)
                                    .then((url) =>
                                      window.open(url, '_blank', 'noopener,noreferrer'),
                                    )
                                    .catch((err) =>
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Could not open receipt.',
                                      ),
                                    )
                                }}
                              >
                                View receipt
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDeleteBill(bill.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ReceiptScanner
            ingredients={ingredients}
            defaultDestination="fixed_bill"
            onSaved={() => load(month)}
          />

          <section className="stack">
            {weekBreakdowns.map((week, index) => {
              const draft = weekDrafts[week.weekStart] ?? {
                groceryBill: '0',
                vegetableBill: '0',
                snacksBill: '0',
                notes: '',
              }
              const weekTotal =
                (Number(draft.groceryBill) || 0) +
                (Number(draft.vegetableBill) || 0) +
                (Number(draft.snacksBill) || 0)

              return (
                <article key={week.weekStart} className="card">
                  <div className="card-header">
                    <div>
                      <h3>
                        Week {index + 1}: {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}
                      </h3>
                      <span className="muted small">
                        {week.days.length === 0
                          ? 'No Mon–Fri menus recorded yet'
                          : week.days
                              .map(
                                (d) =>
                                  `${d.weekday} (${d.studentCount}): ${d.recipeNames.join(', ') || 'No recipes'}`,
                              )
                              .join(' · ')}
                      </span>
                    </div>
                    <span className="badge badge-ok">Week bill: {formatINR(weekTotal)}</span>
                  </div>

                  <div className="kpi-grid" style={{ marginBottom: 16 }}>
                    <CategoryList
                      title="Vegetables (പച്ചക്കറി)"
                      items={week.vegetables}
                      estimated={week.estimatedVegetableCost}
                    />
                    <CategoryList
                      title="Grocery (പലചരക്ക്)"
                      items={week.groceries}
                      estimated={week.estimatedGroceryCost}
                    />
                    <CategoryList
                      title="Snacks (പലഹാരങ്ങൾ)"
                      items={week.snacks}
                      estimated={week.estimatedSnacksCost}
                    />
                  </div>

                  <div className="form-grid">
                    <div>
                      <label htmlFor={`veg-${week.weekStart}`}>Vegetable bill (₹)</label>
                      <input
                        id={`veg-${week.weekStart}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.vegetableBill}
                        onChange={(event) =>
                          updateWeekDraft(week.weekStart, { vegetableBill: event.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor={`groc-${week.weekStart}`}>Grocery bill (₹)</label>
                      <input
                        id={`groc-${week.weekStart}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.groceryBill}
                        onChange={(event) =>
                          updateWeekDraft(week.weekStart, { groceryBill: event.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor={`snacks-${week.weekStart}`}>Snacks bill (₹)</label>
                      <input
                        id={`snacks-${week.weekStart}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.snacksBill}
                        onChange={(event) =>
                          updateWeekDraft(week.weekStart, { snacksBill: event.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor={`notes-${week.weekStart}`}>Notes</label>
                      <input
                        id={`notes-${week.weekStart}`}
                        value={draft.notes}
                        onChange={(event) =>
                          updateWeekDraft(week.weekStart, { notes: event.target.value })
                        }
                        placeholder="Weekly bill note"
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!budget || savingWeek === week.weekStart}
                        onClick={() => void handleSaveWeek(week.weekStart)}
                      >
                        {savingWeek === week.weekStart ? 'Saving…' : 'Save week'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
