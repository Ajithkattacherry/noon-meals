import { useEffect, useState } from 'react'
import { listRecipes, saveRecipe } from '../data/recipes'
import { listIngredients } from '../data/ingredients'
import { compatibleUnits } from '../lib/units'
import { formatQuantity } from '../lib/format'
import type { Ingredient, Recipe, Unit } from '../lib/types'

interface ItemForm {
  ingredientId: string
  quantity: string
  unit: Unit | ''
}

interface FormState {
  id?: string
  name: string
  baseServings: string
  active: boolean
  items: ItemForm[]
}

function emptyForm(): FormState {
  return { name: '', baseServings: '50', active: true, items: [] }
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [nextRecipes, nextIngredients] = await Promise.all([
        listRecipes(),
        listIngredients(),
      ])
      setRecipes(nextRecipes)
      setIngredients(nextIngredients)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load recipes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeIngredients = ingredients.filter((ingredient) => ingredient.active !== false)
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }))
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ingredientId: '', quantity: '', unit: '' }],
    }))
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, position) => position !== index),
    }))
  }

  function startEdit(recipe: Recipe) {
    setForm({
      id: recipe.id,
      name: recipe.name,
      baseServings: String(recipe.baseServings),
      active: recipe.active !== false,
      items: recipe.items.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: String(item.quantity),
        unit: item.unit,
      })),
    })
    setFormError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const baseServings = Number(form.baseServings)

    if (!form.name.trim()) {
      setFormError('Enter a recipe name.')
      return
    }
    if (!Number.isFinite(baseServings) || baseServings <= 0) {
      setFormError('Base servings must be greater than zero.')
      return
    }
    if (form.items.length === 0) {
      setFormError('Add at least one ingredient.')
      return
    }
    if (form.items.some((item) => !item.ingredientId)) {
      setFormError('Choose an ingredient for every row.')
      return
    }
    if (form.items.some((item) => !(Number(item.quantity) > 0))) {
      setFormError('Enter a quantity greater than zero for every ingredient.')
      return
    }
    if (form.items.some((item) => !item.unit)) {
      setFormError('Choose a unit for every row.')
      return
    }

    setSaving(true)
    try {
      await saveRecipe({
        id: form.id,
        name: form.name,
        baseServings,
        active: form.active,
        items: form.items.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: Number(item.quantity),
          unit: item.unit as Unit,
        })),
      })
      setForm(emptyForm())
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the recipe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Recipes</h1>
          <p>
            A recipe records quantities for its base serving count. Daily quantities are scaled
            from that base to the number of children present.
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
            <h2>{form.id ? 'Edit recipe' : 'Add recipe'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="stack" noValidate>
            <div className="form-grid">
              <div>
                <label htmlFor="recipe-name">Recipe name</label>
                <input
                  id="recipe-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Vegetable Curry"
                />
              </div>

              <div>
                <label htmlFor="recipe-servings">Base servings</label>
                <input
                  id="recipe-servings"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.baseServings}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, baseServings: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <div className="card-header" style={{ marginBottom: 0 }}>
                <h3>Ingredients</h3>
                <button type="button" className="btn btn-sm" onClick={addItem}>
                  Add ingredient
                </button>
              </div>

              {form.items.length === 0 && (
                <p className="muted small">No ingredients added yet.</p>
              )}

              {form.items.map((item, index) => {
                const selected = item.ingredientId
                  ? ingredientById.get(item.ingredientId)
                  : undefined
                const unitChoices = selected ? compatibleUnits(selected.unit) : []

                return (
                  <div className="item-row" key={index}>
                    <div>
                      <label htmlFor={`item-ingredient-${index}`}>
                        Ingredient {index + 1}
                      </label>
                      <select
                        id={`item-ingredient-${index}`}
                        aria-label={`Ingredient for item ${index + 1}`}
                        value={item.ingredientId}
                        onChange={(event) => {
                          const ingredient = ingredientById.get(event.target.value)
                          updateItem(index, {
                            ingredientId: event.target.value,
                            unit: ingredient ? ingredient.unit : '',
                          })
                        }}
                      >
                        <option value="">Select ingredient</option>
                        {activeIngredients.map((ingredient) => (
                          <option key={ingredient.id} value={ingredient.id}>
                            {ingredient.name} ({ingredient.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`item-quantity-${index}`}>Quantity</label>
                      <input
                        id={`item-quantity-${index}`}
                        aria-label={`Quantity for item ${index + 1}`}
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, { quantity: event.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor={`item-unit-${index}`}>Unit</label>
                      <select
                        id={`item-unit-${index}`}
                        aria-label={`Unit for item ${index + 1}`}
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(index, { unit: event.target.value as Unit | '' })
                        }
                      >
                        <option value="">Select unit</option>
                        {unitChoices.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-label={`Remove ingredient ${index + 1}`}
                      onClick={() => removeItem(index)}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>

            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save recipe'}
              </button>
              {form.id && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setForm(emptyForm())
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
            <h2>All recipes</h2>
            <span className="badge">{recipes.length}</span>
          </div>

          {loading ? (
            <p className="muted">Loading recipes…</p>
          ) : recipes.length === 0 ? (
            <p className="muted">No recipes yet. Add one with its base serving count.</p>
          ) : (
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <div className="recipe-summary" key={recipe.id}>
                  <div>
                    <strong>{recipe.name}</strong>{' '}
                    <span className="badge">base {recipe.baseServings}</span>
                    {recipe.active === false && <span className="badge">Inactive</span>}
                    <ul>
                      {recipe.items.map((item) => (
                        <li key={item.ingredientId}>
                          {ingredientById.get(item.ingredientId)?.name ?? 'Unknown'}{' '}
                          {formatQuantity(item.quantity, item.unit)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => startEdit(recipe)}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
