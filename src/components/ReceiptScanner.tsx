import { useEffect, useMemo, useState } from 'react'
import { getMonthlyBudget, saveFixedBill, saveMonthlyBudgetTarget } from '../data/budgets'
import { addPurchase } from '../data/purchases'
import {
  computeFileHash,
  createReceiptUpload,
  deleteReceiptUpload,
  getReceiptSignedUrl,
  listReceiptUploads,
  parseReceiptWithEdgeFunction,
  uploadReceiptFile,
} from '../data/receipts'
import { formatDate, formatINR, isISODate, roundMoney, todayISO } from '../lib/format'
import {
  determineTargetType,
  findDuplicateReceipt,
  type DuplicateMatch,
} from '../lib/receipts'
import type {
  Ingredient,
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptItemDestination,
  ReceiptUploadRecord,
} from '../lib/types'

interface ReceiptScannerProps {
  ingredients: Ingredient[]
  defaultDestination?: ReceiptItemDestination
  onSaved: () => Promise<void> | void
}

function emptyItem(
  index: number,
  destination: ReceiptItemDestination,
): ParsedReceiptItem {
  return {
    id: `manual-${Date.now()}-${index}`,
    rawName: '',
    matchedIngredientId: '',
    matchedIngredientName: null,
    destination,
    category: destination === 'fixed_bill' ? 'fixed' : 'grocery',
    quantity: 1,
    unit: 'Each',
    totalPrice: 0,
  }
}

function formatDuplicateWarning(match: DuplicateMatch): string {
  const rec = match.record
  const desc = [
    rec.supplier || rec.fileName,
    rec.billNumber ? `Bill ${rec.billNumber}` : '',
    rec.billDate ? formatDate(rec.billDate) : '',
    rec.totalAmount !== null ? formatINR(rec.totalAmount) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  if (match.reason === 'file_hash') {
    return `Duplicate file detected: this exact file was already uploaded (${desc}).`
  }
  if (match.reason === 'bill_number') {
    return `Possible duplicate bill: same supplier and bill number already exist in upload history (${desc}).`
  }
  return `Possible duplicate bill: another upload already has the same date and total (${desc}).`
}

export default function ReceiptScanner({
  ingredients,
  defaultDestination = 'purchase',
  onSaved,
}: ReceiptScannerProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileHash, setFileHash] = useState<string | null>(null)
  const [duplicateFileMatch, setDuplicateFileMatch] = useState<DuplicateMatch | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{
    storagePath: string
    fileName: string
    mimeType: string
  } | null>(null)
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [uploads, setUploads] = useState<ReceiptUploadRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const activeIngredients = ingredients.filter((i) => i.active !== false)

  async function refreshUploads() {
    try {
      const list = await listReceiptUploads()
      setUploads(list)
    } catch {
      // History is secondary; avoid blocking the scanner if table isn't migrated yet
    }
  }

  useEffect(() => {
    void refreshUploads()
  }, [])

  const metadataDuplicate = useMemo(() => {
    if (!parsed) return null
    return findDuplicateReceipt(uploads, {
      supplier: parsed.supplier,
      billNumber: parsed.billNumber,
      billDate: parsed.billDate,
      totalAmount: parsed.totalAmount,
    })
  }, [parsed, uploads])

  async function handleUploadAndParse(forceDuplicate = false) {
    if (!file) {
      setError('Choose a receipt image or PDF first.')
      return
    }

    setError(null)
    setNotice(null)
    setSuccess(null)
    setParsing(true)

    try {
      const hash = fileHash ?? (await computeFileHash(file))
      setFileHash(hash)

      if (!forceDuplicate && hash) {
        const dup = findDuplicateReceipt(uploads, { fileHash: hash })
        if (dup) {
          setDuplicateFileMatch(dup)
          setParsing(false)
          return
        }
      }
      setDuplicateFileMatch(null)

      const uploaded = await uploadReceiptFile(file)
      setUploadedFile(uploaded)

      try {
        const result = await parseReceiptWithEdgeFunction(file, ingredients)
        setParsed(
          result.items.length > 0
            ? result
            : { ...result, items: [emptyItem(1, defaultDestination)] },
        )
      } catch (parseErr) {
        setNotice(
          'The file was uploaded successfully, but we could not automatically read it. Below, you can enter the receipt details manually to attach it to your records.',
        )
        setParsed({
          supplier: '',
          billNumber: '',
          billDate: todayISO(),
          totalAmount: null,
          items: [emptyItem(1, defaultDestination)],
        })
      }
    } catch (uploadErr) {
      setError(
        uploadErr instanceof Error ? uploadErr.message : 'Could not upload the receipt file.',
      )
    } finally {
      setParsing(false)
    }
  }

  function updateItem(id: string, patch: Partial<ParsedReceiptItem>) {
    setParsed((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }
    })
  }

  function removeItem(id: string) {
    setParsed((prev) => {
      if (!prev) return prev
      return { ...prev, items: prev.items.filter((item) => item.id !== id) }
    })
  }

  function addItemRow() {
    setParsed((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: [...prev.items, emptyItem(prev.items.length + 1, defaultDestination)],
      }
    })
  }

  async function handleSaveAll() {
    if (!parsed || !uploadedFile) return
    setError(null)
    setSuccess(null)

    if (!isISODate(parsed.billDate)) {
      setError('Enter a valid bill date (YYYY-MM-DD).')
      return
    }
    if (parsed.items.length === 0) {
      setError('Add at least one item to save.')
      return
    }

    for (const item of parsed.items) {
      if (item.destination === 'purchase') {
        if (!item.matchedIngredientId) {
          setError(`Select an ingredient for "${item.rawName || 'item'}".`)
          return
        }
        if (!(item.quantity > 0)) {
          setError(`Quantity must be greater than zero for "${item.rawName || 'item'}".`)
          return
        }
      } else if (!item.rawName.trim()) {
        setError('Enter a label for every Monthly Fixed Bill row.')
        return
      }
      if (!Number.isFinite(item.totalPrice) || item.totalPrice < 0) {
        setError('Prices must be zero or positive.')
        return
      }
    }

    setSaving(true)
    try {
      const targetType = determineTargetType(parsed.items)
      const receipt = await createReceiptUpload({
        storagePath: uploadedFile.storagePath,
        fileName: uploadedFile.fileName,
        mimeType: uploadedFile.mimeType,
        fileHash,
        billNumber: parsed.billNumber,
        supplier: parsed.supplier,
        billDate: parsed.billDate,
        totalAmount: parsed.totalAmount,
        targetType,
        parsedPayload: parsed,
        status: 'saved',
      })

      const billNote = [
        parsed.billNumber ? `Bill ${parsed.billNumber}` : '',
        parsed.supplier ? parsed.supplier : '',
      ]
        .filter(Boolean)
        .join(' · ')

      const purchaseRows = parsed.items.filter((i) => i.destination === 'purchase')
      const fixedRows = parsed.items.filter((i) => i.destination === 'fixed_bill')

      for (const item of purchaseRows) {
        await addPurchase({
          ingredientId: item.matchedIngredientId,
          purchaseDate: parsed.billDate,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          supplier: parsed.supplier,
          notes: parsed.billNumber ? `Bill ${parsed.billNumber}` : undefined,
          receiptId: receipt.id,
          receiptPath: receipt.storagePath,
        })
      }

      if (fixedRows.length > 0) {
        const month = parsed.billDate.slice(0, 7)
        const existingBundle = await getMonthlyBudget(month)
        const budget =
          existingBundle.budget ??
          (await saveMonthlyBudgetTarget({
            month,
            siteAmount: null,
            plannedTarget: 0,
          }))

        for (const item of fixedRows) {
          await saveFixedBill({
            monthlyBudgetId: budget.id,
            label: item.rawName.trim(),
            billDate: parsed.billDate,
            amount: item.totalPrice,
            notes: billNote || undefined,
            receiptId: receipt.id,
            receiptPath: receipt.storagePath,
          })
        }
      }

      setParsed(null)
      setFile(null)
      setFileHash(null)
      setDuplicateFileMatch(null)
      setUploadedFile(null)
      setNotice(null)
      setSuccess(
        `Saved ${purchaseRows.length} purchase(s) and ${fixedRows.length} fixed bill(s) with receipt attached.`,
      )
      await Promise.all([refreshUploads(), Promise.resolve(onSaved())])
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Could not save parsed receipt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUpload(upload: ReceiptUploadRecord) {
    setError(null)
    setSuccess(null)
    setDeletingId(upload.id)
    try {
      await deleteReceiptUpload(upload.id, upload.storagePath)
      setConfirmDeleteId(null)
      setSuccess(`Deleted "${upload.fileName}" and its linked database entries.`)
      await Promise.all([refreshUploads(), Promise.resolve(onSaved())])
    } catch (delErr) {
      setError(delErr instanceof Error ? delErr.message : 'Could not delete upload.')
    } finally {
      setDeletingId(null)
    }
  }

  const itemsTotal = parsed
    ? roundMoney(parsed.items.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0))
    : 0

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Attach &amp; parse receipt / bill</h2>
          <span className="muted small">
            Upload a bill photo or PDF (English or Malayalam). Extracted items can be saved to
            Ingredient Purchases or Monthly Fixed Bills.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? 'Hide upload history' : `Upload history (${uploads.length})`}
        </button>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="notice notice-warn" role="status" style={{ marginBottom: 12 }}>
          {notice}
        </p>
      )}
      {success && (
        <p className="success-banner" role="status" style={{ marginBottom: 12 }}>
          {success}
        </p>
      )}

      {duplicateFileMatch && (
        <div className="notice notice-warn" role="alert" style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px' }}>{formatDuplicateWarning(duplicateFileMatch)}</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleUploadAndParse(true)}
            >
              Upload anyway
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDuplicateFileMatch(null)
                setFile(null)
                setFileHash(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: parsed || showHistory ? 16 : 0 }}>
        <div>
          <label htmlFor="receipt-file">Receipt image or PDF</label>
          <input
            id="receipt-file"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setFileHash(null)
              setDuplicateFileMatch(null)
              setError(null)
              setSuccess(null)
            }}
          />
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || parsing}
            onClick={() => void handleUploadAndParse(false)}
          >
            {parsing ? 'Uploading & parsing…' : 'Upload & parse bill'}
          </button>
        </div>
      </div>

      {parsed && (
        <div className="stack" style={{ marginBottom: showHistory ? 20 : 0 }}>
          {metadataDuplicate && (
            <p className="notice notice-warn" role="alert" style={{ margin: 0 }}>
              {formatDuplicateWarning(metadataDuplicate)}
            </p>
          )}

          <div className="form-grid">
            <div>
              <label htmlFor="receipt-supplier">Supplier / Store</label>
              <input
                id="receipt-supplier"
                value={parsed.supplier}
                onChange={(event) =>
                  setParsed({ ...parsed, supplier: event.target.value })
                }
                placeholder="Cheerakuzhy Stores"
              />
            </div>

            <div>
              <label htmlFor="receipt-bill-no">Bill number</label>
              <input
                id="receipt-bill-no"
                value={parsed.billNumber}
                onChange={(event) =>
                  setParsed({ ...parsed, billNumber: event.target.value })
                }
                placeholder="No. 118"
              />
            </div>

            <div>
              <label htmlFor="receipt-date">Bill date</label>
              <input
                id="receipt-date"
                type="date"
                value={parsed.billDate}
                onChange={(event) =>
                  setParsed({ ...parsed, billDate: event.target.value })
                }
              />
            </div>

            <div>
              <label htmlFor="receipt-total">Bill total (₹)</label>
              <input
                id="receipt-total"
                type="number"
                min="0"
                step="0.01"
                value={parsed.totalAmount ?? ''}
                onChange={(event) =>
                  setParsed({
                    ...parsed,
                    totalAmount:
                      event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Save to</th>
                  <th>Ingredient / Bill label</th>
                  <th>Qty</th>
                  <th>Total (₹)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parsed.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <select
                        aria-label={`Destination for ${item.rawName || item.id}`}
                        value={item.destination}
                        onChange={(event) =>
                          updateItem(item.id, {
                            destination: event.target.value as ReceiptItemDestination,
                          })
                        }
                      >
                        <option value="purchase">Ingredient purchase</option>
                        <option value="fixed_bill">Monthly fixed bill</option>
                      </select>
                    </td>
                    <td>
                      {item.destination === 'purchase' ? (
                        <div className="stack" style={{ gap: 4 }}>
                          <select
                            aria-label={`Ingredient for ${item.rawName || item.id}`}
                            value={item.matchedIngredientId}
                            onChange={(event) => {
                              const ing = activeIngredients.find(
                                (i) => i.id === event.target.value,
                              )
                              updateItem(item.id, {
                                matchedIngredientId: event.target.value,
                                matchedIngredientName: ing?.name ?? null,
                                unit: ing?.unit ?? item.unit,
                              })
                            }}
                          >
                            <option value="">Select ingredient</option>
                            {activeIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </option>
                            ))}
                          </select>
                          {item.rawName && (
                            <span className="muted small">Parsed: {item.rawName}</span>
                          )}
                        </div>
                      ) : (
                        <input
                          aria-label={`Label for ${item.rawName || item.id}`}
                          value={item.rawName}
                          onChange={(event) =>
                            updateItem(item.id, { rawName: event.target.value })
                          }
                          placeholder="Gas / Transportation / Loading"
                        />
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`Quantity for ${item.rawName || item.id}`}
                        type="number"
                        min="0"
                        step="0.001"
                        disabled={item.destination === 'fixed_bill'}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, { quantity: Number(event.target.value) })
                        }
                        style={{ width: 90 }}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Price for ${item.rawName || item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.totalPrice}
                        onChange={(event) =>
                          updateItem(item.id, { totalPrice: Number(event.target.value) })
                        }
                        style={{ width: 110 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={addItemRow}>
                + Add row
              </button>
              <span className="muted small">
                Items sum: <strong>{formatINR(itemsTotal)}</strong>
              </span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setParsed(null)
                  setNotice(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void handleSaveAll()}
              >
                {saving ? 'Saving…' : 'Save all to database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3>Receipt upload history</h3>
            <span className="muted small">
              Deleting an upload removes the file and all linked purchases or fixed bills.
            </span>
          </div>

          {uploads.length === 0 ? (
            <p className="muted">No receipts uploaded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bill date</th>
                    <th>Supplier / File</th>
                    <th>Bill no.</th>
                    <th className="num">Total</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td className="nowrap">
                        {upload.billDate ? formatDate(upload.billDate) : '—'}
                      </td>
                      <td>
                        <strong>{upload.supplier || upload.fileName}</strong>
                        {upload.supplier && (
                          <div className="muted small">{upload.fileName}</div>
                        )}
                      </td>
                      <td>{upload.billNumber || '—'}</td>
                      <td className="num">
                        {upload.totalAmount !== null ? formatINR(upload.totalAmount) : '—'}
                      </td>
                      <td>
                        <span className="badge">{upload.targetType.replace('_', ' ')}</span>
                      </td>
                      <td>
                        {confirmDeleteId === upload.id ? (
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={deletingId === upload.id}
                              onClick={() => void handleDeleteUpload(upload)}
                            >
                              {deletingId === upload.id ? 'Deleting…' : 'Confirm delete'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                void getReceiptSignedUrl(upload.storagePath)
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
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setConfirmDeleteId(upload.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
