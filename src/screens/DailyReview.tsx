import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  finalizeMenu,
  getMenuByDate,
  reopenMenu,
  saveDraftMenu,
} from '../data/menus'
import { listRecipes } from '../data/recipes'
import { listIngredients } from '../data/ingredients'
import { listPurchases } from '../data/purchases'
import { computeDay } from '../lib/costing'
import { canFinalize } from '../lib/finalize'
import { formatDate, formatINR, formatQuantity } from '../lib/format'
import { overrideKey } from '../lib/types'
import type {
  DailyMenu as DailyMenuRecord,
  Ingredient,
  Purchase,
  Recipe,
} from '../lib/types'

export default function DailyReview() {
  const { menuDate = '' } = useParams()
  const [menu, setMenu] = useState<DailyMenuRecord | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const [studentCount, setStudentCount] = useState('0')
  const [bufferPercent, setBufferPercent] = useState('0')
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getMenuByDate(menuDate),
      listRecipes(),
      listIngredients(),
      listPurchases(),
    ])
      .then(([loadedMenu, loadedRecipes, loadedIngredients, loadedPurchases]) => {
        if (cancelled) return
        setMenu(loadedMenu)
        setRecipes(loadedRecipes)
        setIngredients(loadedIngredients)
        setPurchases(loadedPurchases)
        if (loadedMenu) {
          setStudentCount(String(loadedMenu.studentCount))
          setBufferPercent(String(loadedMenu.bufferPercent))
          setOverrides(loadedMenu.overrides)
        }
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Could not load this day.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [menuDate, reloadToken])

  const calc = useMemo(() => {
    if (!menu) return null
    if (menu.status === 'finalized' && menu.snapshot) return menu.snapshot

    const selectedRecipes = menu.recipeIds
      .map((recipeId) => recipes.find((recipe) => recipe.id === recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe))

    return computeDay({
      menuDate: menu.menuDate,
      studentCount: Number(studentCount) || 0,
      bufferPercent: Number(bufferPercent) || 0,
      recipes: selectedRecipes,
      ingredients,
      purchases,
      overrides,
    })
  }, [menu, recipes, ingredients, purchases, studentCount, bufferPercent, overrides])

  const draft = menu?.status === 'draft'

  function flagKind(recipeId: string, ingredientId: string) {
    return calc?.flags.find(
      (flag) => flag.recipeId === recipeId && flag.ingredientId === ingredientId,
    )?.kind
  }

  async function persistDraft() {
    if (!menu || !draft) return
    try {
      const saved = await saveDraftMenu({
        menuDate: menu.menuDate,
        studentCount: Number(studentCount) || 0,
        bufferPercent: Number(bufferPercent) || 0,
        recipeIds: menu.recipeIds,
        overrides,
      })
      setMenu(saved)
      setNotice('Draft saved.')
      setActionError(null)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not save the draft.')
    }
  }

  async function handleFinalize() {
    if (!menu || !calc || !canFinalize(calc)) return
    setBusy(true)
    setActionError(null)
    try {
      await finalizeMenu(menu.menuDate, calc)
      setMenu({
        ...menu,
        status: 'finalized',
        snapshot: calc,
        finalizedAt: new Date().toISOString(),
      })
      setNotice('Day finalized. The snapshot is now immutable.')
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not finalize the day.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReopen() {
    if (!menu) return
    if (!reason.trim()) {
      setActionError('Enter a reason to reopen this day.')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      await reopenMenu(menu.menuDate, reason)
      setMenu({ ...menu, status: 'draft', snapshot: null, finalizedAt: null })
      setReason('')
      setNotice('Day reopened. It is editable again and the old snapshot is in the audit log.')
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not reopen the day.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading the day…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-banner" role="alert">
          {error}
        </p>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setReloadToken((token) => token + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!menu || !calc) {
    return (
      <div className="card">
        <h1>Review {formatDate(menuDate)}</h1>
        <p className="muted">No menu exists for this date yet.</p>
        <Link className="btn btn-primary" to="/daily">
          Create the menu
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Review {formatDate(menu.menuDate)}</h1>
          <p>
            Scaled quantities use the most recent purchase on or before this date. A missing
            price is flagged, never treated as zero.
          </p>
        </div>
        <span className={draft ? 'badge badge-draft' : 'badge badge-ok'}>
          {draft ? 'Draft' : 'Finalized'}
        </span>
      </div>

      {notice && (
        <p className="success-banner" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </p>
      )}
      {actionError && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {actionError}
        </p>
      )}

      <section className="card">
        <div className="card-header">
          <h2>Day settings</h2>
          {menu.finalizedAt && (
            <span className="muted small">
              Finalized {new Date(menu.finalizedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>

        <div className="form-grid">
          <div>
            <label htmlFor="review-students">Student count</label>
            <input
              id="review-students"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={studentCount}
              disabled={!draft}
              onChange={(event) => setStudentCount(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="review-buffer">Buffer percent</label>
            <input
              id="review-buffer"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={bufferPercent}
              disabled={!draft}
              onChange={(event) => setBufferPercent(event.target.value)}
            />
          </div>

          {draft && (
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void persistDraft()}>
                Save draft
              </button>
            </div>
          )}
        </div>

        {draft && (
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            Quantities update as you type. Override a line to pin its final scaled quantity.
          </p>
        )}
      </section>

      {calc.flags.length > 0 && (
        <div className="notice notice-danger" role="alert" style={{ marginBottom: 20 }}>
          <strong>This day cannot be finalized yet.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {calc.flags.map((flag) => {
              const recipe = calc.recipes.find((entry) => entry.recipeId === flag.recipeId)
              const line = recipe?.lines.find(
                (entry) => entry.ingredientId === flag.ingredientId,
              )
              return (
                <li key={`${flag.kind}-${flag.recipeId}-${flag.ingredientId}`}>
                  {flag.kind === 'missing_price'
                    ? `Missing price for ${line?.ingredientName ?? 'an ingredient'}`
                    : `Unit mismatch for ${line?.ingredientName ?? 'an ingredient'}`}{' '}
                  in {recipe?.name ?? 'a recipe'}.
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {calc.recipes.map((recipe) => (
        <section className="recipe-block" key={recipe.recipeId}>
          <div className="recipe-block-header">
            <h3>{recipe.name}</h3>
            <span className="muted small">
              base {recipe.baseServings} · recipe cost {formatINR(recipe.cost)}
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="num">Base</th>
                  <th className="num">Scaled</th>
                  <th className="num">Override</th>
                  <th className="num">Unit price</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recipe.lines.map((line) => {
                  const key = overrideKey(line.recipeId, line.ingredientId)
                  const kind = flagKind(line.recipeId, line.ingredientId)
                  return (
                    <tr key={key}>
                      <td>
                        <strong>{line.ingredientName}</strong>
                        {line.overridden && (
                          <>
                            {' '}
                            <span className="badge badge-warn">overridden</span>
                          </>
                        )}
                        {kind && (
                          <div className="line-flag">
                            {kind === 'missing_price' ? 'Missing price' : 'Unit mismatch'}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        {kind === 'unit_mismatch'
                          ? '—'
                          : formatQuantity(line.baseQuantity, line.unit)}
                      </td>
                      <td className="num">
                        {formatQuantity(line.scaledQuantity, line.unit)}
                      </td>
                      <td className="num">
                        {draft ? (
                          <input
                            className="override-input"
                            aria-label={`Override quantity for ${line.ingredientName}`}
                            type="number"
                            min="0"
                            step="0.001"
                            value={overrides[key] ?? ''}
                            placeholder={String(line.scaledQuantity)}
                            onChange={(event) => {
                              const value = event.target.value
                              setOverrides((current) => {
                                const next = { ...current }
                                if (value === '') delete next[key]
                                else next[key] = Number(value)
                                return next
                              })
                            }}
                            onBlur={() => void persistDraft()}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {line.price ? (
                          <>
                            {formatINR(line.price.unitPrice)}/{line.unit}
                            {line.price.carriedOver && (
                              <>
                                {' '}
                                <span className="badge badge-warn">carried over</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="badge badge-danger">
                            {kind === 'unit_mismatch' ? 'Unit mismatch' : 'Missing price'}
                          </span>
                        )}
                      </td>
                      <td className="num">{line.cost === null ? '—' : formatINR(line.cost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="card">
        <div className="card-header">
          <h2>Day totals</h2>
        </div>

        <div className="day-totals">
          <div className="day-total">
            <div className="kpi-label">Day total</div>
            <div className="kpi-value">{formatINR(calc.total)}</div>
          </div>

          <div className="day-total">
            <div className="kpi-label">Cost per child</div>
            <div className="kpi-value">
              {calc.costPerChild !== null ? formatINR(calc.costPerChild) : '—'}
            </div>
            <div className="kpi-hint">
              {calc.complete
                ? `${calc.studentCount} children present`
                : 'Incomplete — resolve the flags first'}
            </div>
          </div>

          <div className="day-total">
            <div className="kpi-label">Status</div>
            <div className="kpi-value" style={{ fontSize: '1.05rem' }}>
              <span className={calc.complete ? 'badge badge-ok' : 'badge badge-danger'}>
                {calc.complete ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <div className="kpi-hint">{calc.flags.length} flag(s)</div>
          </div>
        </div>

        {draft && (
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !canFinalize(calc)}
              onClick={() => void handleFinalize()}
            >
              {busy ? 'Working…' : 'Finalize day'}
            </button>
            {!canFinalize(calc) && (
              <span className="muted small">
                Resolve every flag before finalizing. Missing prices are never treated as zero.
              </span>
            )}
          </div>
        )}
      </section>

      {!draft && (
        <section className="card">
          <h2>Reopen this day</h2>
          <p className="muted">
            Reopening sets the day back to draft and stores the finalized snapshot with your
            reason in the audit log.
          </p>
          <div className="form-grid">
            <div>
              <label htmlFor="reopen-reason">Reason for reopening</label>
              <input
                id="reopen-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Corrected the onion price"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void handleReopen()}
              >
                Reopen day
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
