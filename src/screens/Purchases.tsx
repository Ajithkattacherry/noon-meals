import { useEffect, useMemo, useState } from 'react'
import { addPurchase, listPurchases, updatePurchase } from '../data/purchases'
import { listIngredients } from '../data/ingredients'
import { getReceiptSignedUrl } from '../data/receipts'
import ReceiptScanner from '../components/ReceiptScanner'
import { formatDate, formatINR, isISODate, roundMoney, todayISO } from '../lib/format'
import type { Ingredient, Purchase } from '../lib/types'

interface FormState {
  id?: string
  ingredientId: string
  purchaseDate: string
  quantity: string
  totalPrice: string
  supplier: string
  notes: string
}

function emptyForm(): FormState {
  return {
    ingredientId: '',
    purchaseDate: todayISO(),
    quantity: '',
    totalPrice: '',
    supplier: '',
    notes: '',
  }
}

export default function Purchases() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [nextIngredients, nextPurchases] = await Promise.all([
        listIngredients(),
        listPurchases(),
      ])
      setIngredients(nextIngredients)
      setPurchases(nextPurchases)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load purchases.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  )

  const selectedIngredient = form.ingredientId
    ? ingredientById.get(form.ingredientId)
    : undefined

  const quantity = Number(form.quantity)
  const totalPrice = Number(form.totalPrice)
  const unitPricePreview =
    selectedIngredient &&
    form.quantity !== '' &&
    form.totalPrice !== '' &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    Number.isFinite(totalPrice) &&
    totalPrice >= 0
      ? `${formatINR(totalPrice / quantity)}/${selectedIngredient.unit}`
      : null

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function startEdit(purchase: Purchase) {
    setForm({
      id: purchase.id,
      ingredientId: purchase.ingredientId,
      purchaseDate: purchase.purchaseDate,
      quantity: purchase.quantity !== undefined ? String(purchase.quantity) : '',
      totalPrice: purchase.totalPrice !== undefined ? String(purchase.totalPrice) : '',
      supplier: purchase.supplier ?? '',
      notes: purchase.notes ?? '',
    })
    setFormError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!form.ingredientId) {
      setFormError('Choose an ingredient.')
      return
    }
    if (!isISODate(form.purchaseDate)) {
      setFormError('Enter a valid purchase date.')
      return
    }
    if (!(quantity > 0)) {
      setFormError('Quantity must be greater than zero.')
      return
    }
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      setFormError('Total price must be zero or more.')
      return
    }

    setSaving(true)
    try {
      if (form.id) {
        await updatePurchase({
          id: form.id,
          ingredientId: form.ingredientId,
          purchaseDate: form.purchaseDate,
          quantity,
          totalPrice,
          supplier: form.supplier,
          notes: form.notes,
        })
        setForm(emptyForm())
      } else {
        await addPurchase({
          ingredientId: form.ingredientId,
          purchaseDate: form.purchaseDate,
          quantity,
          totalPrice,
          supplier: form.supplier,
          notes: form.notes,
        })
        setForm((current) => ({
          ...emptyForm(),
          ingredientId: current.ingredientId,
          purchaseDate: current.purchaseDate,
        }))
      }
      await load()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the purchase.')
    } finally {
      setSaving(false)
    }
  }

  const visiblePurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      if (filter !== 'all' && purchase.ingredientId !== filter) return false
      if (fromDate && purchase.purchaseDate < fromDate) return false
      if (toDate && purchase.purchaseDate > toDate) return false
      return true
    })
  }, [purchases, filter, fromDate, toDate])

  const filteredTotalCost = useMemo(
    () =>
      roundMoney(
        visiblePurchases.reduce(
          (sum, purchase) => sum + (purchase.totalPrice ?? 0),
          0,
        ),
      ),
    [visiblePurchases],
  )

  const hasFilters = filter !== 'all' || fromDate !== '' || toDate !== ''
  const selectableIngredients = ingredients.filter(
    (ingredient) => ingredient.active !== false || ingredient.id === form.ingredientId,
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Purchases</h1>
          <p>
            Record each ingredient purchase. The unit price is calculated from the total price and
            quantity, and you can edit any past purchase from the history table.
          </p>
        </div>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <ReceiptScanner
        ingredients={ingredients}
        defaultDestination="purchase"
        onSaved={load}
      />

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h2>{form.id ? 'Edit purchase' : 'Add purchase'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="stack" noValidate>
            <div className="form-grid">
              <div>
                <label htmlFor="purchase-ingredient">Ingredient</label>
                <select
                  id="purchase-ingredient"
                  value={form.ingredientId}
                  onChange={(event) => update('ingredientId', event.target.value)}
                >
                  <option value="">Select ingredient</option>
                  {selectableIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="purchase-date">Purchase date</label>
                <input
                  id="purchase-date"
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) => update('purchaseDate', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="purchase-quantity">Quantity</label>
                <input
                  id="purchase-quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(event) => update('quantity', event.target.value)}
                  placeholder="10"
                />
              </div>

              <div>
                <label htmlFor="purchase-total">Total price (₹)</label>
                <input
                  id="purchase-total"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.totalPrice}
                  onChange={(event) => update('totalPrice', event.target.value)}
                  placeholder="400"
                />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label htmlFor="purchase-supplier">Supplier (optional)</label>
                <input
                  id="purchase-supplier"
                  value={form.supplier}
                  onChange={(event) => update('supplier', event.target.value)}
                  placeholder="Market stall"
                />
              </div>

              <div>
                <label htmlFor="purchase-notes">Notes (optional)</label>
                <input
                  id="purchase-notes"
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  placeholder="Price correction, quality note"
                />
              </div>
            </div>

            <div className="notice" role="status" aria-live="polite">
              Unit price:{' '}
              {unitPricePreview ? (
                <strong>{unitPricePreview}</strong>
              ) : (
                <span className="muted">enter a quantity and total price</span>
              )}
            </div>

            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add purchase'}
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
            <h2>Purchase history</h2>
            <span className="badge">{visiblePurchases.length} item(s)</span>
          </div>

          <div className="form-grid" style={{ marginBottom: 14 }}>
            <div>
              <label htmlFor="purchase-filter">Filter by ingredient</label>
              <select
                id="purchase-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All ingredients</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="purchase-from">From date</label>
              <input
                id="purchase-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="purchase-to">To date</label>
              <input
                id="purchase-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>

            {hasFilters && (
              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setFilter('all')
                    setFromDate('')
                    setToDate('')
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div className="notice" style={{ marginBottom: 14 }}>
            Total cost for selection: <strong>{formatINR(filteredTotalCost)}</strong>
          </div>

          {loading ? (
            <p className="muted">Loading purchases…</p>
          ) : visiblePurchases.length === 0 ? (
            <p className="muted">
              {hasFilters ? 'No purchases match the selected filters.' : 'No purchases recorded yet.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ingredient</th>
                    <th className="num">Quantity</th>
                    <th className="num">Total</th>
                    <th className="num">Unit price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePurchases.map((purchase) => {
                    const ingredient = ingredientById.get(purchase.ingredientId)
                    return (
                      <tr key={purchase.id}>
                        <td className="nowrap">{formatDate(purchase.purchaseDate)}</td>
                        <td>
                          <strong>{ingredient?.name ?? 'Unknown'}</strong>
                          {purchase.supplier && (
                            <div className="muted small">{purchase.supplier}</div>
                          )}
                        </td>
                        <td className="num">
                          {purchase.quantity ?? '—'} {ingredient?.unit ?? ''}
                        </td>
                        <td className="num">
                          {purchase.totalPrice !== undefined
                            ? formatINR(purchase.totalPrice)
                            : '—'}
                        </td>
                        <td className="num">{formatINR(purchase.unitPrice)}</td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => startEdit(purchase)}
                            >
                              Edit
                            </button>
                            {purchase.receiptPath && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  void getReceiptSignedUrl(purchase.receiptPath!)
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
