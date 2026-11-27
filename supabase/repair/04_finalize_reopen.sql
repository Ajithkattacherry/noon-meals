-- Repair part 4 of 5: finalize_menu and reopen_menu.
-- Paste into Supabase SQL Editor and Run. Safe to run more than once.

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

grant execute on function public.finalize_menu(date, jsonb) to authenticated;

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

grant execute on function public.reopen_menu(date, text) to authenticated;
