-- Repair part 3 of 5: save_draft_menu.
-- Paste into Supabase SQL Editor and Run. Safe to run more than once.

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

grant execute on function public.save_draft_menu(date, integer, numeric, uuid[], jsonb) to authenticated;
