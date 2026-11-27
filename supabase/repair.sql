-- Repair script: brings an existing database up to the intended schema.
-- Safe to run more than once. Paste the whole file into the Supabase SQL
-- Editor and click Run. It ends by asking PostgREST to reload its schema
-- cache, so the RPCs appear immediately.

-- ---------------------------------------------------------------------------
-- Row level security: authenticated only, anon sees nothing
-- ---------------------------------------------------------------------------

alter table public.ingredients enable row level security;
alter table public.purchases enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.daily_menus enable row level security;
alter table public.daily_menu_recipes enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "authenticated manage ingredients" on public.ingredients;
create policy "authenticated manage ingredients" on public.ingredients
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage purchases" on public.purchases;
create policy "authenticated manage purchases" on public.purchases
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage recipes" on public.recipes;
create policy "authenticated manage recipes" on public.recipes
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage recipe items" on public.recipe_items;
create policy "authenticated manage recipe items" on public.recipe_items
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage daily menus" on public.daily_menus;
create policy "authenticated manage daily menus" on public.daily_menus
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage daily menu recipes" on public.daily_menu_recipes;
create policy "authenticated manage daily menu recipes" on public.daily_menu_recipes
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage audit log" on public.audit_log;
create policy "authenticated manage audit log" on public.audit_log
  for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Transactional RPCs
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

-- Ask PostgREST to pick up the new functions right away.
notify pgrst, 'reload schema';
