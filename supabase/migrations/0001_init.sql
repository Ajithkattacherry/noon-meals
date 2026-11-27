-- School Meal Expense Tracker — initial schema
-- Run with `supabase db reset` (local) or `supabase db push` (hosted).
-- One shared teacher account for the MVP: every table is readable and writable
-- by the `authenticated` role, and invisible to `anon`. A later guest role only
-- needs a new read-only policy per table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  unit text not null check (unit in ('Kg', 'Gram', 'Liter', 'Millilitre', 'Each')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  purchase_date date not null,
  quantity numeric not null check (quantity > 0),
  total_price numeric not null check (total_price >= 0),
  unit_price numeric generated always as (total_price / quantity) stored,
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);

create index purchases_ingredient_date_idx
  on public.purchases (ingredient_id, purchase_date, created_at);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  base_servings integer not null check (base_servings > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('Kg', 'Gram', 'Liter', 'Millilitre', 'Each')),
  unique (recipe_id, ingredient_id)
);

create table public.daily_menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null unique,
  student_count integer not null check (student_count >= 0),
  buffer_percent numeric not null default 0 check (buffer_percent >= 0),
  overrides jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  snapshot jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or snapshot is not null)
);

create table public.daily_menu_recipes (
  daily_menu_id uuid not null references public.daily_menus (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  primary key (daily_menu_id, recipe_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  daily_menu_id uuid not null references public.daily_menus (id) on delete cascade,
  action text not null check (action in ('reopen')),
  reason text not null check (btrim(reason) <> ''),
  before jsonb,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: authenticated only
-- ---------------------------------------------------------------------------

alter table public.ingredients enable row level security;
alter table public.purchases enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.daily_menus enable row level security;
alter table public.daily_menu_recipes enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated manage ingredients" on public.ingredients
  for all to authenticated using (true) with check (true);
create policy "authenticated manage purchases" on public.purchases
  for all to authenticated using (true) with check (true);
create policy "authenticated manage recipes" on public.recipes
  for all to authenticated using (true) with check (true);
create policy "authenticated manage recipe items" on public.recipe_items
  for all to authenticated using (true) with check (true);
create policy "authenticated manage daily menus" on public.daily_menus
  for all to authenticated using (true) with check (true);
create policy "authenticated manage daily menu recipes" on public.daily_menu_recipes
  for all to authenticated using (true) with check (true);
create policy "authenticated manage audit log" on public.audit_log
  for all to authenticated using (true) with check (true);

-- Read access for anon is intentionally absent: RLS returns zero rows.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Transactional helpers
-- ---------------------------------------------------------------------------

create or replace function public.save_recipe(
  p_id uuid,
  p_name text,
  p_base_servings integer,
  p_items jsonb,
  p_active boolean default true
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into recipes (name, base_servings, active)
    values (p_name, p_base_servings, p_active)
    returning id into v_id;
  else
    update recipes
       set name = p_name, base_servings = p_base_servings, active = p_active
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Recipe % not found', p_id;
    end if;

    delete from recipe_items where recipe_id = v_id;
  end if;

  insert into recipe_items (recipe_id, ingredient_id, quantity, unit)
  select v_id,
         (item ->> 'ingredient_id')::uuid,
         (item ->> 'quantity')::numeric,
         item ->> 'unit'
    from jsonb_array_elements(p_items) as item;

  return v_id;
end;
$$;

create or replace function public.save_draft_menu(
  p_menu_date date,
  p_student_count integer,
  p_buffer_percent numeric,
  p_recipe_ids uuid[],
  p_overrides jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  select id, status into v_id, v_status
    from daily_menus
   where menu_date = p_menu_date;

  if v_status = 'finalized' then
    raise exception 'Menu for % is finalized; reopen it before editing', p_menu_date;
  end if;

  if v_id is null then
    insert into daily_menus (menu_date, student_count, buffer_percent, overrides)
    values (p_menu_date, p_student_count, p_buffer_percent, coalesce(p_overrides, '{}'::jsonb))
    returning id into v_id;
  else
    update daily_menus
       set student_count = p_student_count,
           buffer_percent = p_buffer_percent,
           overrides = coalesce(p_overrides, '{}'::jsonb),
           updated_at = now()
     where id = v_id;

    delete from daily_menu_recipes where daily_menu_id = v_id;
  end if;

  insert into daily_menu_recipes (daily_menu_id, recipe_id)
  select v_id, recipe_id from unnest(p_recipe_ids) as recipe_id;

  return v_id;
end;
$$;

create or replace function public.finalize_menu(
  p_menu_date date,
  p_snapshot jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update daily_menus
     set status = 'finalized',
         snapshot = p_snapshot,
         finalized_at = now(),
         updated_at = now()
   where menu_date = p_menu_date
     and status = 'draft';

  if not found then
    raise exception 'No draft menu found for %', p_menu_date;
  end if;
end;
$$;

create or replace function public.reopen_menu(
  p_menu_date date,
  p_reason text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_snapshot jsonb;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reopen a finalized day';
  end if;

  select id, status, snapshot into v_id, v_status, v_snapshot
    from daily_menus
   where menu_date = p_menu_date;

  if v_id is null then
    raise exception 'No menu found for %', p_menu_date;
  end if;

  if v_status <> 'finalized' then
    raise exception 'Menu for % is not finalized', p_menu_date;
  end if;

  insert into audit_log (daily_menu_id, action, reason, before)
  values (v_id, 'reopen', btrim(p_reason), v_snapshot);

  update daily_menus
     set status = 'draft',
         snapshot = null,
         finalized_at = null,
         updated_at = now()
   where id = v_id;
end;
$$;

grant execute on function public.save_recipe(uuid, text, integer, jsonb, boolean) to authenticated;
grant execute on function public.save_draft_menu(date, integer, numeric, uuid[], jsonb) to authenticated;
grant execute on function public.finalize_menu(date, jsonb) to authenticated;
grant execute on function public.reopen_menu(date, text) to authenticated;
