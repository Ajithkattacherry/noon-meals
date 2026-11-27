import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMenuByDate, listMenus, saveDraftMenu, type MenuSummary } from '../data/menus'
import { listRecipes } from '../data/recipes'
import { previousStudentCount } from '../lib/menus'
import { formatDate, isISODate, todayISO } from '../lib/format'
import type { DailyMenu as DailyMenuRecord, Recipe } from '../lib/types'

export default function DailyMenu() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [menu, setMenu] = useState<DailyMenuRecord | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [menus, setMenus] = useState<MenuSummary[]>([])
  const [referenceLoading, setReferenceLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [studentCount, setStudentCount] = useState('')
  const [bufferPercent, setBufferPercent] = useState('0')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReferenceLoading(true)
    Promise.all([listRecipes(), listMenus()])
      .then(([nextRecipes, nextMenus]) => {
        if (cancelled) return
        setRecipes(nextRecipes)
        setMenus(nextMenus)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Could not load the menu setup.')
      })
      .finally(() => {
        if (!cancelled) setReferenceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (referenceLoading) return
    let cancelled = false
    setMenuLoading(true)
    setError(null)

    getMenuByDate(date)
      .then((loaded) => {
        if (cancelled) return
        setMenu(loaded)
        if (loaded) {
          setStudentCount(String(loaded.studentCount))
          setBufferPercent(String(loaded.bufferPercent))
          setSelectedIds(loaded.recipeIds)
          setOverrides(loaded.overrides)
        } else {
          const previous = previousStudentCount(menus, date)
          setStudentCount(previous === null ? '' : String(previous))
          setBufferPercent('0')
          setSelectedIds([])
          setOverrides({})
        }
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Could not load the menu for that date.')
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [date, menus, referenceLoading])

  const finalized = menu?.status === 'finalized'
  const activeRecipes = recipes.filter((recipe) => recipe.active !== false)

  function toggleRecipe(recipeId: string) {
    setSelectedIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!isISODate(date)) {
      setError('Choose a valid menu date.')
      return
    }

    const count = Number(studentCount)
    if (!Number.isInteger(count) || count < 0) {
      setError('Student count must be a whole number of zero or more.')
      return
    }

    const buffer = Number(bufferPercent)
    if (!Number.isFinite(buffer) || buffer < 0) {
      setError('Buffer percent must be zero or more.')
      return
    }

    if (selectedIds.length === 0) {
      setError('Choose at least one recipe for the day.')
      return
    }

    setSaving(true)
    try {
      await saveDraftMenu({
        menuDate: date,
        studentCount: count,
        bufferPercent: buffer,
        recipeIds: selectedIds,
        overrides,
      })
      navigate(`/review/${date}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the draft menu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Daily menu</h1>
          <p>
            Pick the date, confirm the number of children present, and choose the recipes served.
            Quantities and costs are calculated on the review screen.
          </p>
        </div>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h2>Menu for {formatDate(date)}</h2>
            {menu && (
              <span className={finalized ? 'badge badge-warn' : 'badge badge-draft'}>
                {finalized ? 'Finalized' : 'Draft'}
              </span>
            )}
          </div>

          {finalized && (
            <div className="notice notice-warn" style={{ marginBottom: 16 }}>
              This day is finalized. Reopen it from the{' '}
              <Link to={`/review/${date}`}>review screen</Link> to make changes.
            </div>
          )}

          <form onSubmit={handleSave} className="stack" noValidate>
            <div className="form-grid">
              <div>
                <label htmlFor="menu-date">Menu date</label>
                <input
                  id="menu-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="menu-students">Student count</label>
                <input
                  id="menu-students"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={studentCount}
                  onChange={(event) => setStudentCount(event.target.value)}
                  disabled={finalized}
                />
              </div>

              <div>
                <label htmlFor="menu-buffer">Buffer percent</label>
                <input
                  id="menu-buffer"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={bufferPercent}
                  onChange={(event) => setBufferPercent(event.target.value)}
                  disabled={finalized}
                />
              </div>
            </div>

            <div>
              <h3>Recipes served</h3>
              {menuLoading ? (
                <p className="muted">Loading recipes…</p>
              ) : activeRecipes.length === 0 ? (
                <p className="muted">
                  No active recipes yet. <Link to="/recipes">Add a recipe</Link> first.
                </p>
              ) : (
                <div>
                  {activeRecipes.map((recipe) => (
                    <div className="checkbox-row" key={recipe.id}>
                      <input
                        id={`menu-recipe-${recipe.id}`}
                        type="checkbox"
                        checked={selectedIds.includes(recipe.id)}
                        onChange={() => toggleRecipe(recipe.id)}
                        disabled={finalized}
                      />
                      <label htmlFor={`menu-recipe-${recipe.id}`}>
                        {recipe.name}{' '}
                        <span className="muted small">(base {recipe.baseServings})</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || finalized || menuLoading || referenceLoading}
              >
                {saving ? 'Saving…' : 'Save and review'}
              </button>
              {menu && (
                <Link className="btn btn-ghost" to={`/review/${date}`}>
                  Open review
                </Link>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Recorded menus</h2>
          </div>

          {referenceLoading ? (
            <p className="muted">Loading menus…</p>
          ) : menus.length === 0 ? (
            <p className="muted">No menus recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Students</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...menus].reverse().map((summary) => (
                    <tr key={summary.id}>
                      <td className="nowrap">{formatDate(summary.menuDate)}</td>
                      <td className="num">{summary.studentCount}</td>
                      <td>
                        <span
                          className={
                            summary.status === 'finalized'
                              ? 'badge badge-ok'
                              : 'badge badge-draft'
                          }
                        >
                          {summary.status === 'finalized' ? 'Finalized' : 'Draft'}
                        </span>
                      </td>
                      <td className="num">
                        <Link to={`/review/${summary.menuDate}`}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
