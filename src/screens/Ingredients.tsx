import { useEffect, useState } from 'react'
import { listIngredients, saveIngredient } from '../data/ingredients'
import { UNITS } from '../lib/units'
import type { Ingredient, Unit } from '../lib/types'

interface FormState {
  id?: string
  name: string
  unit: Unit | ''
  description: string
  active: boolean
}

const EMPTY_FORM: FormState = { name: '', unit: '', description: '', active: true }

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setIngredients(await listIngredients())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load ingredients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Enter an ingredient name.')
      return
    }
    if (!form.unit) {
      setFormError('Choose a unit.')
      return
    }

    setSaving(true)
    try {
      await saveIngredient({
        id: form.id,
        name: form.name,
        unit: form.unit,
        description: form.description,
        active: form.active,
      })
      setForm(EMPTY_FORM)
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the ingredient.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(ingredient: Ingredient) {
    setError(null)
    setBusyId(ingredient.id)
    try {
      await saveIngredient({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        description: ingredient.description ?? undefined,
        active: ingredient.active === false,
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the ingredient.')
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(ingredient: Ingredient) {
    setForm({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      description: ingredient.description ?? '',
      active: ingredient.active !== false,
    })
    setFormError(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ingredients</h1>
          <p>
            Every ingredient has exactly one unit. Deactivated ingredients stay in history but
            disappear from purchase and recipe pickers.
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
            <h2>{form.id ? 'Edit ingredient' : 'Add ingredient'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="stack" noValidate>
            <div>
              <label htmlFor="ingredient-name">Name</label>
              <input
                id="ingredient-name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Onion"
              />
            </div>

            <div>
              <label htmlFor="ingredient-unit">Unit</label>
              <select
                id="ingredient-unit"
                value={form.unit}
                onChange={(event) => update('unit', event.target.value as Unit | '')}
              >
                <option value="">Select unit</option>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ingredient-description">Description (optional)</label>
              <input
                id="ingredient-description"
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Local variety, bought weekly"
              />
            </div>

            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save ingredient'}
              </button>
              {form.id && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setFormError(null)
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>All ingredients</h2>
            <span className="badge">{ingredients.length}</span>
          </div>

          {loading ? (
            <p className="muted">Loading ingredients…</p>
          ) : ingredients.length === 0 ? (
            <p className="muted">No ingredients yet. Add Onion to get started.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ingredient) => {
                    const active = ingredient.active !== false
                    return (
                      <tr key={ingredient.id} className={active ? '' : 'row-inactive'}>
                        <td>
                          <strong>{ingredient.name}</strong>
                          {ingredient.description && (
                            <div className="muted small">{ingredient.description}</div>
                          )}
                        </td>
                        <td>{ingredient.unit}</td>
                        <td>
                          <span className={active ? 'badge badge-ok' : 'badge'}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => startEdit(ingredient)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={active ? 'btn btn-danger btn-sm' : 'btn btn-sm'}
                              disabled={busyId === ingredient.id}
                              onClick={() => void toggleActive(ingredient)}
                            >
                              {active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
