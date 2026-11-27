import { errorMessage, requireSupabase } from './supabase'
import { normalizeParsedReceipt, type RawEdgeReceipt } from '../lib/receipts'
import type {
  Ingredient,
  ParsedReceipt,
  ReceiptTargetType,
  ReceiptUploadRecord,
} from '../lib/types'

interface ReceiptUploadRow {
  id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_hash: string | null
  bill_number: string | null
  supplier: string | null
  bill_date: string | null
  total_amount: number | null
  target_type: ReceiptTargetType
  status: 'uploaded' | 'parsed' | 'saved' | 'failed'
  created_at: string
}

function mapUpload(row: ReceiptUploadRow): ReceiptUploadRecord {
  return {
    id: row.id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileHash: row.file_hash,
    billNumber: row.bill_number,
    supplier: row.supplier,
    billDate: row.bill_date,
    totalAmount: row.total_amount === null ? null : Number(row.total_amount),
    targetType: row.target_type,
    status: row.status,
    createdAt: row.created_at,
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read file contents.'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

export async function computeFileHash(file: File): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof file.arrayBuffer !== 'function') {
    return null
  }
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function listReceiptUploads(): Promise<ReceiptUploadRecord[]> {
  const { data, error } = await requireSupabase()
    .from('receipt_uploads')
    .select(
      'id, storage_path, file_name, mime_type, file_hash, bill_number, supplier, bill_date, total_amount, target_type, status, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))
  return (data as ReceiptUploadRow[]).map(mapUpload)
}

export async function uploadReceiptFile(file: File): Promise<{
  storagePath: string
  fileName: string
  mimeType: string
}> {
  const client = requireSupabase()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`

  const { error } = await client.storage.from('receipts').upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) throw new Error(errorMessage(error))

  return {
    storagePath,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
  }
}

export async function parseReceiptWithEdgeFunction(
  file: File,
  ingredients: Ingredient[],
): Promise<ParsedReceipt> {
  const client = requireSupabase()
  const fileBase64 = await readFileAsBase64(file)

  const { data, error } = await client.functions.invoke('parse-receipt', {
    body: {
      fileBase64,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name,
      ingredients: ingredients
        .filter((i) => i.active !== false)
        .map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          category: i.category ?? 'grocery',
        })),
    },
  })

  if (error) {
    throw new Error(error.message || 'Receipt parsing service failed.')
  }

  return normalizeParsedReceipt((data ?? {}) as RawEdgeReceipt, ingredients)
}

export async function createReceiptUpload(input: {
  storagePath: string
  fileName: string
  mimeType: string
  fileHash?: string | null
  billNumber?: string
  supplier?: string
  billDate?: string
  totalAmount?: number | null
  targetType: ReceiptTargetType
  parsedPayload?: unknown
  status?: 'uploaded' | 'parsed' | 'saved' | 'failed'
}): Promise<{ id: string; storagePath: string }> {
  const { data, error } = await requireSupabase()
    .from('receipt_uploads')
    .insert({
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_hash: input.fileHash ?? null,
      bill_number: input.billNumber?.trim() || null,
      supplier: input.supplier?.trim() || null,
      bill_date: input.billDate || null,
      total_amount: input.totalAmount ?? null,
      target_type: input.targetType,
      parsed_payload: input.parsedPayload ?? null,
      status: input.status ?? 'saved',
    })
    .select('id, storage_path')
    .single()

  if (error) throw new Error(errorMessage(error))
  const row = data as { id: string; storage_path: string }
  return { id: row.id, storagePath: row.storage_path }
}

export async function deleteReceiptUpload(id: string, storagePath: string): Promise<void> {
  const client = requireSupabase()
  const { error: rpcError } = await client.rpc('delete_receipt_upload', {
    p_receipt_id: id,
  })
  if (rpcError) throw new Error(errorMessage(rpcError))

  if (storagePath) {
    await client.storage.from('receipts').remove([storagePath])
  }
}

export async function getReceiptSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from('receipts')
    .createSignedUrl(storagePath, 300)

  if (error) throw new Error(errorMessage(error))
  if (!data?.signedUrl) throw new Error('Could not generate a link for this receipt.')
  return data.signedUrl
}
