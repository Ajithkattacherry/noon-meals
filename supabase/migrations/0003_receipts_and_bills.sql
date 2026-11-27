-- Receipt & Bill Attachment + Parsing migration
-- Creates private `receipts` storage bucket, `receipt_uploads` metadata table,
-- and links `purchases` and `monthly_fixed_bills` to attached receipts.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "authenticated manage receipt files" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');

create table public.receipt_uploads (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  bill_number text,
  supplier text,
  bill_date date,
  total_amount numeric check (total_amount is null or total_amount >= 0),
  target_type text not null default 'purchase' check (target_type in ('purchase', 'fixed_bill', 'mixed')),
  parsed_payload jsonb,
  status text not null default 'parsed' check (status in ('uploaded', 'parsed', 'saved', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.purchases
  add column if not exists receipt_id uuid references public.receipt_uploads (id) on delete set null,
  add column if not exists receipt_path text;

alter table public.monthly_fixed_bills
  add column if not exists receipt_id uuid references public.receipt_uploads (id) on delete set null,
  add column if not exists receipt_path text;

alter table public.receipt_uploads enable row level security;

create policy "authenticated manage receipt uploads" on public.receipt_uploads
  for all to authenticated using (true) with check (true);

grant select on public.receipt_uploads to anon;
grant select, insert, update, delete on public.receipt_uploads to authenticated;
