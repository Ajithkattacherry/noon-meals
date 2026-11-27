-- Monthly Budget & Weekly Bill Planner migration
-- Extends ingredients with category and adds monthly_budgets,
-- monthly_fixed_bills, and weekly_bill_allocations with authenticated-only RLS.

alter table public.ingredients
  add column if not exists category text not null default 'grocery'
  check (category in ('fixed', 'grocery', 'vegetable', 'snacks'));

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^\d{4}-\d{2}$'),
  site_amount numeric check (site_amount is null or site_amount >= 0),
  planned_target numeric not null default 0 check (planned_target >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_fixed_bills (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets (id) on delete cascade,
  label text not null check (btrim(label) <> ''),
  bill_date date not null,
  amount numeric not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index monthly_fixed_bills_budget_idx
  on public.monthly_fixed_bills (monthly_budget_id, bill_date);

create table public.weekly_bill_allocations (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets (id) on delete cascade,
  week_start date not null,
  grocery_bill numeric not null default 0 check (grocery_bill >= 0),
  vegetable_bill numeric not null default 0 check (vegetable_bill >= 0),
  snacks_bill numeric not null default 0 check (snacks_bill >= 0),
  notes text,
  updated_at timestamptz not null default now(),
  unique (monthly_budget_id, week_start)
);

alter table public.monthly_budgets enable row level security;
alter table public.monthly_fixed_bills enable row level security;
alter table public.weekly_bill_allocations enable row level security;

create policy "authenticated manage monthly budgets" on public.monthly_budgets
  for all to authenticated using (true) with check (true);
create policy "authenticated manage monthly fixed bills" on public.monthly_fixed_bills
  for all to authenticated using (true) with check (true);
create policy "authenticated manage weekly bill allocations" on public.weekly_bill_allocations
  for all to authenticated using (true) with check (true);

grant select on public.monthly_budgets, public.monthly_fixed_bills, public.weekly_bill_allocations to anon;
grant select, insert, update, delete on public.monthly_budgets, public.monthly_fixed_bills, public.weekly_bill_allocations to authenticated;
