import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMenuByDate, listFinalizedMenus } from '../data/menus'
import { listRecipes } from '../data/recipes'
import { listIngredients } from '../data/ingredients'
import { listPurchases } from '../data/purchases'
import { computeDay } from '../lib/costing'
import { summarizeByPeriod } from '../lib/reports'
import { formatDate, formatINR, todayISO } from '../lib/format'
import type {
  DailyMenu as DailyMenuRecord,
  DayCalculation,
  Ingredient,
  Purchase,
  Recipe,
} from '../lib/types'

export default function Dashboard() {
  const today = todayISO()
  const [menu, setMenu] = useState<DailyMenuRecord | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [snapshots, setSnapshots] = useState<DayCalculation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getMenuByDate(today),
      listRecipes(),
      listIngredients(),
      listPurchases(),
      listFinalizedMenus(),
    ])
      .then(([nextMenu, nextRecipes, nextIngredients, nextPurchases, nextSnapshots]) => {
        if (cancelled) return
        setMenu(nextMenu)
        setRecipes(nextRecipes)
        setIngredients(nextIngredients)
        setPurchases(nextPurchases)
        setSnapshots(nextSnapshots)
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load the dashboard.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [today])

  const calc = useMemo(() => {
    if (!menu) return null
    if (menu.status === 'finalized' && menu.snapshot) return menu.snapshot

    const selectedRecipes = menu.recipeIds
      .map((recipeId) => recipes.find((recipe) => recipe.id === recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe))

    return computeDay({
      menuDate: menu.menuDate,
      studentCount: menu.studentCount,
      bufferPercent: menu.bufferPercent,
      recipes: selectedRecipes,
      ingredients,
      purchases,
      overrides: menu.overrides,
    })
  }, [menu, recipes, ingredients, purchases])

  const monthKey = today.slice(0, 7)
  const monthSummary = summarizeByPeriod(
    snapshots.filter((snapshot) => snapshot.menuDate.startsWith(monthKey)),
    'month',
  )[0]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Today is {formatDate(today)}.</p>
        </div>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="card">
          <p className="muted">Loading the dashboard…</p>
        </div>
      ) : (
        <div className="grid-2">
          <section className="card">
            <div className="card-header">
              <h2>Today’s menu</h2>
              {menu && (
                <span
                  className={
                    menu.status === 'finalized' ? 'badge badge-ok' : 'badge badge-draft'
                  }
                >
                  {menu.status === 'finalized' ? 'Finalized' : 'Draft'}
                </span>
              )}
            </div>

            {!menu ? (
              <>
                <p className="muted">No menu has been set for today yet.</p>
                <Link className="btn btn-primary" to="/daily">
                  Set today’s menu
                </Link>
              </>
            ) : calc ? (
              <>
                <div className="kpi-grid">
                  <div className="kpi">
                    <div className="kpi-label">Children</div>
                    <div className="kpi-value">{calc.studentCount}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">Recipes</div>
                    <div className="kpi-value">{calc.recipes.length}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">Estimated total</div>
                    <div className="kpi-value">{formatINR(calc.total)}</div>
                    <div className="kpi-hint">
                      {calc.complete ? 'All lines priced' : 'Incomplete — some prices missing'}
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">Cost per child</div>
                    <div className="kpi-value">
                      {calc.costPerChild !== null ? formatINR(calc.costPerChild) : '—'}
                    </div>
                    <div className="kpi-hint">
                      {calc.complete ? 'Finalizable' : 'Resolve flags to finalize'}
                    </div>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 16 }}>
                  <Link className="btn btn-primary" to={`/review/${menu.menuDate}`}>
                    Open today’s review
                  </Link>
                  <Link className="btn btn-ghost" to="/daily">
                    Edit menu
                  </Link>
                </div>
              </>
            ) : null}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>This month</h2>
              <span className="badge">{monthKey}</span>
            </div>

            {monthSummary ? (
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kpi-label">Total spent</div>
                  <div className="kpi-value">{formatINR(monthSummary.total)}</div>
                  <div className="kpi-hint">{monthSummary.days} finalized day(s)</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Student-days</div>
                  <div className="kpi-value">{monthSummary.studentDays}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Cost per child</div>
                  <div className="kpi-value">
                    {monthSummary.costPerChild !== null
                      ? formatINR(monthSummary.costPerChild)
                      : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">No finalized days this month yet.</p>
            )}

            <div className="form-actions" style={{ marginTop: 16 }}>
              <Link className="btn btn-ghost" to="/reports">
                Open reports
              </Link>
            </div>
          </section>
        </div>
      )}

      {!loading && (
        <section className="card">
          <div className="card-header">
            <h2>Quick actions</h2>
          </div>
          <div className="form-actions">
            <Link className="btn" to="/purchases">
              Record a purchase
            </Link>
            <Link className="btn" to="/recipes">
              Manage recipes
            </Link>
            <Link className="btn" to="/ingredients">
              Manage ingredients
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
