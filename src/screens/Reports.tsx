import { useEffect, useState } from 'react'
import { listFinalizedMenus } from '../data/menus'
import {
  summarizeByIngredient,
  summarizeByPeriod,
  summarizeByRecipe,
  type Period,
} from '../lib/reports'
import { formatDate, formatINR, formatQuantity } from '../lib/format'
import type { DayCalculation } from '../lib/types'

type Tab = Period | 'ingredient' | 'recipe'

const TABS: { id: Tab; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'ingredient', label: 'Ingredient' },
  { id: 'recipe', label: 'Recipe' },
]

function monthLabel(key: string): string {
  const [, month, year] = formatDate(`${key}-01`).split('-')
  return `${month} ${year}`
}

export default function Reports() {
  const [snapshots, setSnapshots] = useState<DayCalculation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('day')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listFinalizedMenus(from || undefined, to || undefined)
      .then((next) => {
        if (!cancelled) setSnapshots(next)
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load reports.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [from, to])

  const periodRows =
    tab === 'day' || tab === 'week' || tab === 'month'
      ? summarizeByPeriod(snapshots, tab)
      : []
  const ingredientRows = tab === 'ingredient' ? summarizeByIngredient(snapshots) : []
  const recipeRows = tab === 'recipe' ? summarizeByRecipe(snapshots) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>
            Reports read only finalized day snapshots, so changing a purchase price later never
            rewrites history.
          </p>
        </div>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <section className="card">
        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div>
            <label htmlFor="report-from">From</label>
            <input
              id="report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="report-to">To</label>
            <input
              id="report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
            >
              Clear range
            </button>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Report grouping">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className="tab"
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading reports…</p>
        ) : snapshots.length === 0 ? (
          <p className="muted">No finalized days in this range.</p>
        ) : (
          <div role="tabpanel">
            {(tab === 'day' || tab === 'week' || tab === 'month') && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tab === 'day' ? 'Date' : tab === 'week' ? 'Week of' : 'Month'}</th>
                      <th className="num">Days</th>
                      <th className="num">Student-days</th>
                      <th className="num">Total</th>
                      <th className="num">Cost per child</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((row) => (
                      <tr key={row.key}>
                        <td className="nowrap">
                          {tab === 'month'
                            ? monthLabel(row.key)
                            : formatDate(row.key)}
                        </td>
                        <td className="num">{row.days}</td>
                        <td className="num">{row.studentDays}</td>
                        <td className="num">{formatINR(row.total)}</td>
                        <td className="num">
                          {row.costPerChild === null ? '—' : formatINR(row.costPerChild)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'ingredient' && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th className="num">Quantity</th>
                      <th className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientRows.map((row) => (
                      <tr key={row.ingredientId}>
                        <td>{row.ingredientName}</td>
                        <td className="num">{formatQuantity(row.quantity, row.unit)}</td>
                        <td className="num">{formatINR(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'recipe' && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recipe</th>
                      <th className="num">Times served</th>
                      <th className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeRows.map((row) => (
                      <tr key={row.recipeId}>
                        <td>{row.name}</td>
                        <td className="num">{row.timesServed}</td>
                        <td className="num">{formatINR(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
