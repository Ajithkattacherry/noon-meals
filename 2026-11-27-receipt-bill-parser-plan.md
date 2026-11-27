# Receipt & Bill Attachment + AI Parsing — Feature Plan

**Goal:** Allow the teacher to attach receipt/bill images or PDFs (including handwritten Malayalam/English store bills and printed gas/transport bills), parse them via a Supabase Edge Function using Gemini Vision, review/map extracted items, and save them into both **Ingredient Purchases** (`purchases`) and **Monthly Fixed Bills** (`monthly_fixed_bills`) with the original receipt linked for viewing.

## Architecture

1. **Storage & Database (`supabase/migrations/0003_receipts_and_bills.sql`)**
   - Private Supabase Storage bucket `receipts` (authenticated-only RLS).
   - `public.receipt_uploads` table storing `storage_path`, `file_name`, `mime_type`, `bill_number`, `supplier`, `bill_date`, `total_amount`, `target_type`, `parsed_payload`, `status`.
   - `receipt_id` and `receipt_path` columns added to `public.purchases` and `public.monthly_fixed_bills`.

2. **Edge Function (`supabase/functions/parse-receipt/index.ts`)**
   - Verifies authenticated caller, reads `GEMINI_API_KEY` from Supabase secrets, calls Gemini Vision (`gemini-2.5-flash`) with structured JSON output to extract `supplier`, `billNumber`, `billDate`, `totalAmount`, and `items[]`.

3. **Pure Logic (`src/lib/receipts.ts` + `src/lib/receipts.test.ts`)**
   - Normalizes units (`kg`, `gm`, `ltr`, `ml`, `nos` -> `Unit`), dates, and amounts.
   - Matches parsed item names to existing `Ingredient` records.

4. **Data & UI (`src/data/receipts.ts`, `src/components/ReceiptScanner.tsx`, `Purchases.tsx`, `BudgetPlanner.tsx`)**
   - Reusable `ReceiptScanner` panel on **Purchases** and **Budget planner**.
   - Supports camera/file upload, AI parsing, editable review table routing rows to either `purchases` or `monthly_fixed_bills`, and **View receipt** signed-URL links in both history tables.
