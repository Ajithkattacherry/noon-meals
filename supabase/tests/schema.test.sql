begin;
select plan(4);

-- 1. A recipe must have a positive base serving count.
select throws_ok(
  $$ insert into public.recipes (name, base_servings) values ('Bad Recipe', 0) $$,
  '23514',
  null,
  'recipe base servings must be greater than zero'
);

-- 2. Only one menu per date.
insert into public.daily_menus (menu_date, student_count)
values ('2026-11-26', 100);

select throws_ok(
  $$ insert into public.daily_menus (menu_date, student_count) values ('2026-11-26', 90) $$,
  '23505',
  null,
  'menu date is unique'
);

-- 3. Unit price is generated from total price and quantity.
insert into public.ingredients (name, unit) values ('Onion', 'Kg');

insert into public.purchases (ingredient_id, purchase_date, quantity, total_price)
select id, '2026-11-24', 10, 400
  from public.ingredients
 where name = 'Onion';

select is(
  (select unit_price from public.purchases where quantity = 10),
  40::numeric,
  'unit price is total price divided by quantity'
);

-- 4. Anonymous visitors see no data.
set local role anon;
select is(
  (select count(*) from public.ingredients),
  0::bigint,
  'anon sees no ingredients'
);
reset role;

select * from finish();
rollback;
