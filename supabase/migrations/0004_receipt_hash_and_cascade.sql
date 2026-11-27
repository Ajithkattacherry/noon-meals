-- Add file_hash for duplicate receipt detection and atomic delete helper
-- Run in Supabase Dashboard -> SQL Editor.

alter table public.receipt_uploads
  add column if not exists file_hash text;

create index if not exists receipt_uploads_file_hash_idx
  on public.receipt_uploads (file_hash)
  where file_hash is not null;

create index if not exists receipt_uploads_date_total_idx
  on public.receipt_uploads (bill_date, total_amount);

create or replace function public.delete_receipt_upload(p_receipt_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.purchases where receipt_id = p_receipt_id;
  delete from public.monthly_fixed_bills where receipt_id = p_receipt_id;
  delete from public.receipt_uploads where id = p_receipt_id;
end;
$$;

grant execute on function public.delete_receipt_upload(uuid) to authenticated;
