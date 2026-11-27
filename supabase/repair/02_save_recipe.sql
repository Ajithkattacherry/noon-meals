-- Repair part 2 of 5: save_recipe.
-- Paste into Supabase SQL Editor and Run. Safe to run more than once.

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

grant execute on function public.save_recipe(uuid, text, integer, jsonb, boolean) to authenticated;
