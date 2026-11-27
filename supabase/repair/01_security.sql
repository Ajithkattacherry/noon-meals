-- Repair part 1 of 5: row level security, policies and grants.
-- Paste into Supabase SQL Editor and Run. Safe to run more than once.

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
