-- Seed script for October 2026 (St. Mary's HSS, Vallarpadam)
-- Paste and run in Supabase Dashboard -> SQL Editor.
-- Idempotent for ingredients, recipes, monthly_budgets, weekly_bill_allocations, and daily_menus.

begin;

-- 1. Ingredients
insert into public.ingredients (name, unit, category, description, active) values
  ('Rice', 'Kg', 'fixed', 'Monthly rice allotment', true),
  ('Kovakka', 'Kg', 'vegetable', 'Ivy gourd', true),
  ('Onion', 'Kg', 'vegetable', 'Big onion / Savala', true),
  ('Carrot', 'Kg', 'vegetable', null, true),
  ('Beans', 'Kg', 'vegetable', null, true),
  ('Cabbage', 'Kg', 'vegetable', null, true),
  ('Cheera', 'Kg', 'vegetable', 'Spinach / Amaranth', true),
  ('Beetroot', 'Kg', 'vegetable', null, true),
  ('Drumstick', 'Kg', 'vegetable', 'Muringakka', true),
  ('Tomato', 'Kg', 'vegetable', null, true),
  ('Green Chilli', 'Kg', 'vegetable', null, true),
  ('Garlic', 'Kg', 'vegetable', null, true),
  ('Tamarind', 'Kg', 'vegetable', 'Valampuli', true),
  ('Vazhakoombu', 'Each', 'vegetable', 'Banana blossom', true),
  ('Chena', 'Kg', 'vegetable', 'Elephant foot yam', true),
  ('Achinga Payar', 'Kg', 'vegetable', 'Long beans', true),
  ('Raw Banana', 'Kg', 'vegetable', 'Kaya', true),
  ('Potato', 'Kg', 'vegetable', null, true),
  ('Coconut', 'Each', 'vegetable', null, true),
  ('Toor Dal', 'Kg', 'grocery', 'Parippu', true),
  ('Vanpayar', 'Kg', 'grocery', 'Red cowpeas', true),
  ('Kadala', 'Kg', 'grocery', 'Bengal gram / Brown kadala', true),
  ('Green Peas', 'Kg', 'grocery', null, true),
  ('Soya Chunks', 'Kg', 'grocery', null, true),
  ('Coconut Oil', 'Liter', 'grocery', null, true),
  ('Curd', 'Liter', 'grocery', 'Yogurt / Moru', true),
  ('Milk', 'Liter', 'grocery', null, true),
  ('Egg', 'Each', 'grocery', null, true),
  ('Semiya', 'Kg', 'snacks', 'Vermicelli for payasam', true),
  ('Sugar', 'Kg', 'snacks', null, true)
on conflict (name) do update
  set category = excluded.category;

-- 2. Baseline purchase prices for 01-Oct-2026 (if none exist yet for that ingredient/date)
insert into public.purchases (ingredient_id, purchase_date, quantity, total_price, supplier, notes)
select i.id, '2026-10-01'::date, v.qty, v.total, 'Cheerakuzhy Stores', 'October baseline rate'
from (values
  ('Rice', 100, 4000),
  ('Kovakka', 10, 500),
  ('Onion', 25, 1125),
  ('Carrot', 15, 900),
  ('Beans', 10, 700),
  ('Cabbage', 15, 600),
  ('Cheera', 10, 500),
  ('Beetroot', 10, 500),
  ('Drumstick', 5, 400),
  ('Tomato', 15, 675),
  ('Green Chilli', 3, 240),
  ('Garlic', 2, 360),
  ('Tamarind', 3, 450),
  ('Vazhakoombu', 10, 250),
  ('Chena', 15, 750),
  ('Achinga Payar', 10, 650),
  ('Raw Banana', 15, 750),
  ('Potato', 15, 675),
  ('Coconut', 40, 1200),
  ('Toor Dal', 20, 2800),
  ('Vanpayar', 10, 1100),
  ('Kadala', 15, 1500),
  ('Green Peas', 10, 1100),
  ('Soya Chunks', 10, 1200),
  ('Coconut Oil', 10, 2200),
  ('Curd', 20, 1200),
  ('Milk', 30, 1680),
  ('Egg', 200, 1300),
  ('Semiya', 10, 800),
  ('Sugar', 10, 450)
) as v(name, qty, total)
join public.ingredients i on i.name = v.name
where not exists (
  select 1 from public.purchases p
  where p.ingredient_id = i.id and p.purchase_date = '2026-10-01'::date
);

-- 3. Recipes (base_servings = 100)
insert into public.recipes (name, base_servings, active) values
  ('Rice', 100, true),
  ('Kovakka Thoran', 100, true),
  ('Dhal Curry', 100, true),
  ('Pulissery', 100, true),
  ('Soya Curry', 100, true),
  ('Sambar', 100, true),
  ('Beans Carrot Thoran', 100, true),
  ('Milk', 100, true),
  ('Kadala Masala', 100, true),
  ('Cabbage Carrot Thoran', 100, true),
  ('Egg', 100, true),
  ('Cheera Payar Thoran', 100, true),
  ('Koottu Curry', 100, true),
  ('Erissery', 100, true),
  ('Beetroot Pachadi', 100, true),
  ('Theeyal', 100, true),
  ('Drumstick Tomato Curry', 100, true),
  ('Vazhakoombu Cheera Payar Thoran', 100, true),
  ('Carrot Thoran', 100, true),
  ('Kovakka Mezhukkupuratti', 100, true),
  ('Kaalan', 100, true),
  ('Achinga Kaya Thoran', 100, true),
  ('Parippu Thakkali Chaaru Curry', 100, true),
  ('Semiya Payasam', 100, true),
  ('Potato Curry', 100, true),
  ('Green Peas Masala', 100, true),
  ('Chena Curry', 100, true)
on conflict (name) do nothing;

-- Recipe items
insert into public.recipe_items (recipe_id, ingredient_id, quantity, unit)
select r.id, i.id, v.qty, v.unit
from (values
  ('Rice', 'Rice', 10, 'Kg'),
  ('Kovakka Thoran', 'Kovakka', 4, 'Kg'),
  ('Kovakka Thoran', 'Coconut', 4, 'Each'),
  ('Kovakka Thoran', 'Green Chilli', 200, 'Gram'),
  ('Dhal Curry', 'Toor Dal', 3, 'Kg'),
  ('Dhal Curry', 'Onion', 1, 'Kg'),
  ('Dhal Curry', 'Tomato', 1, 'Kg'),
  ('Pulissery', 'Curd', 5, 'Liter'),
  ('Pulissery', 'Coconut', 5, 'Each'),
  ('Pulissery', 'Green Chilli', 150, 'Gram'),
  ('Soya Curry', 'Soya Chunks', 3, 'Kg'),
  ('Soya Curry', 'Onion', 2, 'Kg'),
  ('Soya Curry', 'Tomato', 1.5, 'Kg'),
  ('Sambar', 'Toor Dal', 3, 'Kg'),
  ('Sambar', 'Onion', 2, 'Kg'),
  ('Sambar', 'Carrot', 1.5, 'Kg'),
  ('Sambar', 'Drumstick', 1.5, 'Kg'),
  ('Sambar', 'Tomato', 1.5, 'Kg'),
  ('Sambar', 'Tamarind', 250, 'Gram'),
  ('Beans Carrot Thoran', 'Beans', 2.5, 'Kg'),
  ('Beans Carrot Thoran', 'Carrot', 2.5, 'Kg'),
  ('Beans Carrot Thoran', 'Coconut', 4, 'Each'),
  ('Milk', 'Milk', 15, 'Liter'),
  ('Kadala Masala', 'Kadala', 4, 'Kg'),
  ('Kadala Masala', 'Onion', 2, 'Kg'),
  ('Kadala Masala', 'Tomato', 1.5, 'Kg'),
  ('Kadala Masala', 'Garlic', 200, 'Gram'),
  ('Cabbage Carrot Thoran', 'Cabbage', 3.5, 'Kg'),
  ('Cabbage Carrot Thoran', 'Carrot', 1.5, 'Kg'),
  ('Cabbage Carrot Thoran', 'Coconut', 4, 'Each'),
  ('Egg', 'Egg', 100, 'Each'),
  ('Cheera Payar Thoran', 'Cheera', 3, 'Kg'),
  ('Cheera Payar Thoran', 'Vanpayar', 1.5, 'Kg'),
  ('Cheera Payar Thoran', 'Coconut', 4, 'Each'),
  ('Koottu Curry', 'Chena', 3, 'Kg'),
  ('Koottu Curry', 'Raw Banana', 2, 'Kg'),
  ('Koottu Curry', 'Kadala', 1.5, 'Kg'),
  ('Koottu Curry', 'Coconut', 5, 'Each'),
  ('Erissery', 'Chena', 4, 'Kg'),
  ('Erissery', 'Vanpayar', 1.5, 'Kg'),
  ('Erissery', 'Coconut', 5, 'Each'),
  ('Beetroot Pachadi', 'Beetroot', 3.5, 'Kg'),
  ('Beetroot Pachadi', 'Curd', 3, 'Liter'),
  ('Beetroot Pachadi', 'Coconut', 3, 'Each'),
  ('Theeyal', 'Onion', 3, 'Kg'),
  ('Theeyal', 'Tamarind', 300, 'Gram'),
  ('Theeyal', 'Coconut', 6, 'Each'),
  ('Drumstick Tomato Curry', 'Drumstick', 3, 'Kg'),
  ('Drumstick Tomato Curry', 'Tomato', 2.5, 'Kg'),
  ('Drumstick Tomato Curry', 'Onion', 1.5, 'Kg'),
  ('Vazhakoombu Cheera Payar Thoran', 'Vazhakoombu', 4, 'Each'),
  ('Vazhakoombu Cheera Payar Thoran', 'Cheera', 2, 'Kg'),
  ('Vazhakoombu Cheera Payar Thoran', 'Vanpayar', 1, 'Kg'),
  ('Carrot Thoran', 'Carrot', 4, 'Kg'),
  ('Carrot Thoran', 'Coconut', 4, 'Each'),
  ('Kovakka Mezhukkupuratti', 'Kovakka', 4.5, 'Kg'),
  ('Kovakka Mezhukkupuratti', 'Onion', 1, 'Kg'),
  ('Kovakka Mezhukkupuratti', 'Coconut Oil', 500, 'Millilitre'),
  ('Kaalan', 'Chena', 3, 'Kg'),
  ('Kaalan', 'Raw Banana', 2, 'Kg'),
  ('Kaalan', 'Curd', 4, 'Liter'),
  ('Achinga Kaya Thoran', 'Achinga Payar', 3, 'Kg'),
  ('Achinga Kaya Thoran', 'Raw Banana', 2, 'Kg'),
  ('Achinga Kaya Thoran', 'Coconut', 4, 'Each'),
  ('Parippu Thakkali Chaaru Curry', 'Toor Dal', 2.5, 'Kg'),
  ('Parippu Thakkali Chaaru Curry', 'Tomato', 2, 'Kg'),
  ('Parippu Thakkali Chaaru Curry', 'Tamarind', 200, 'Gram'),
  ('Semiya Payasam', 'Semiya', 2.5, 'Kg'),
  ('Semiya Payasam', 'Milk', 12, 'Liter'),
  ('Semiya Payasam', 'Sugar', 3, 'Kg'),
  ('Potato Curry', 'Potato', 5, 'Kg'),
  ('Potato Curry', 'Onion', 2, 'Kg'),
  ('Potato Curry', 'Tomato', 1.5, 'Kg'),
  ('Green Peas Masala', 'Green Peas', 3.5, 'Kg'),
  ('Green Peas Masala', 'Onion', 2, 'Kg'),
  ('Green Peas Masala', 'Tomato', 1.5, 'Kg'),
  ('Chena Curry', 'Chena', 4, 'Kg'),
  ('Chena Curry', 'Vanpayar', 1.5, 'Kg'),
  ('Chena Curry', 'Coconut', 4, 'Each')
) as v(recipe_name, ing_name, qty, unit)
join public.recipes r on r.name = v.recipe_name
join public.ingredients i on i.name = v.ing_name
on conflict (recipe_id, ingredient_id) do nothing;

-- 4. October 2026 Daily Menus (default student_count = 100)
insert into public.daily_menus (menu_date, student_count, buffer_percent, status) values
  ('2026-10-03', 100, 0, 'draft'),
  ('2026-10-05', 100, 0, 'draft'),
  ('2026-10-06', 100, 0, 'draft'),
  ('2026-10-07', 100, 0, 'draft'),
  ('2026-10-08', 100, 0, 'draft'),
  ('2026-10-09', 100, 0, 'draft'),
  ('2026-10-12', 100, 0, 'draft'),
  ('2026-10-13', 100, 0, 'draft'),
  ('2026-10-14', 100, 0, 'draft'),
  ('2026-10-15', 100, 0, 'draft'),
  ('2026-10-16', 100, 0, 'draft'),
  ('2026-10-17', 100, 0, 'draft'),
  ('2026-10-22', 100, 0, 'draft'),
  ('2026-10-23', 100, 0, 'draft'),
  ('2026-10-24', 100, 0, 'draft'),
  ('2026-10-26', 100, 0, 'draft'),
  ('2026-10-27', 100, 0, 'draft'),
  ('2026-10-28', 100, 0, 'draft'),
  ('2026-10-29', 100, 0, 'draft'),
  ('2026-10-30', 100, 0, 'draft')
on conflict (menu_date) do nothing;

insert into public.daily_menu_recipes (daily_menu_id, recipe_id)
select dm.id, r.id
from (values
  ('2026-10-03', 'Rice'), ('2026-10-03', 'Kovakka Thoran'), ('2026-10-03', 'Dhal Curry'),
  ('2026-10-05', 'Rice'), ('2026-10-05', 'Pulissery'), ('2026-10-05', 'Soya Curry'),
  ('2026-10-06', 'Rice'), ('2026-10-06', 'Sambar'), ('2026-10-06', 'Beans Carrot Thoran'), ('2026-10-06', 'Milk'),
  ('2026-10-07', 'Rice'), ('2026-10-07', 'Kadala Masala'), ('2026-10-07', 'Cabbage Carrot Thoran'), ('2026-10-07', 'Egg'),
  ('2026-10-08', 'Rice'), ('2026-10-08', 'Cheera Payar Thoran'), ('2026-10-08', 'Koottu Curry'), ('2026-10-08', 'Milk'),
  ('2026-10-09', 'Rice'), ('2026-10-09', 'Erissery'), ('2026-10-09', 'Beetroot Pachadi'),
  ('2026-10-12', 'Rice'), ('2026-10-12', 'Theeyal'), ('2026-10-12', 'Cheera Payar Thoran'),
  ('2026-10-13', 'Rice'), ('2026-10-13', 'Drumstick Tomato Curry'), ('2026-10-13', 'Vazhakoombu Cheera Payar Thoran'), ('2026-10-13', 'Milk'),
  ('2026-10-14', 'Rice'), ('2026-10-14', 'Carrot Thoran'), ('2026-10-14', 'Kovakka Mezhukkupuratti'), ('2026-10-14', 'Egg'),
  ('2026-10-15', 'Rice'), ('2026-10-15', 'Sambar'), ('2026-10-15', 'Chena Curry'), ('2026-10-15', 'Milk'),
  ('2026-10-16', 'Rice'), ('2026-10-16', 'Erissery'), ('2026-10-16', 'Kaalan'),
  ('2026-10-17', 'Rice'), ('2026-10-17', 'Pulissery'), ('2026-10-17', 'Kovakka Mezhukkupuratti'),
  ('2026-10-22', 'Rice'), ('2026-10-22', 'Achinga Kaya Thoran'), ('2026-10-22', 'Parippu Thakkali Chaaru Curry'), ('2026-10-22', 'Milk'),
  ('2026-10-23', 'Rice'), ('2026-10-23', 'Kadala Masala'), ('2026-10-23', 'Cheera Payar Thoran'), ('2026-10-23', 'Semiya Payasam'),
  ('2026-10-24', 'Rice'), ('2026-10-24', 'Koottu Curry'), ('2026-10-24', 'Pulissery'), ('2026-10-24', 'Egg'),
  ('2026-10-26', 'Rice'), ('2026-10-26', 'Theeyal'), ('2026-10-26', 'Cabbage Carrot Thoran'),
  ('2026-10-27', 'Rice'), ('2026-10-27', 'Sambar'), ('2026-10-27', 'Beetroot Pachadi'), ('2026-10-27', 'Potato Curry'), ('2026-10-27', 'Milk'),
  ('2026-10-28', 'Rice'), ('2026-10-28', 'Green Peas Masala'), ('2026-10-28', 'Egg'),
  ('2026-10-29', 'Rice'), ('2026-10-29', 'Kovakka Mezhukkupuratti'), ('2026-10-29', 'Carrot Thoran'), ('2026-10-29', 'Milk'),
  ('2026-10-30', 'Rice'), ('2026-10-30', 'Cheera Payar Thoran'), ('2026-10-30', 'Beans Carrot Thoran')
) as v(m_date, r_name)
join public.daily_menus dm on dm.menu_date = v.m_date::date
join public.recipes r on r.name = v.r_name
on conflict do nothing;

-- 5. Monthly Budget (2026-10)
insert into public.monthly_budgets (month, site_amount, planned_target, notes)
values (
  '2026-10',
  42754.00,
  42754.00,
  'St. Mary''s HSS, Vallarpadam — Oct 2026 (Cheerakuzhy Stores & Maveli Store)'
)
on conflict (month) do update
  set site_amount = excluded.site_amount,
      planned_target = excluded.planned_target,
      notes = excluded.notes;

-- 6. Fixed Monthly Bills (Total: 7,477.80)
delete from public.monthly_fixed_bills
where monthly_budget_id = (select id from public.monthly_budgets where month = '2026-10');

insert into public.monthly_fixed_bills (monthly_budget_id, label, bill_date, amount, notes)
select b.id, v.label, v.bill_date::date, v.amount, v.notes
from public.monthly_budgets b
cross join (values
  ('Gas (Cylinder 1)', '2026-10-05', 1952.60, 'Gas refill 1'),
  ('Gas (Cylinder 2)', '2026-10-15', 1952.60, 'Gas refill 2'),
  ('Gas (Cylinder 3)', '2026-10-26', 1952.60, 'Gas refill 3'),
  ('Transportation', '2026-10-30', 1500.00, 'Monthly transport charge'),
  ('Loading', '2026-10-30', 120.00, 'Loading charge')
) as v(label, bill_date, amount, notes)
where b.month = '2026-10';

-- 7. Weekly Bill Allocations (Total: 18,310.20 Veg + 16,966.00 Grocery = 35,276.20)
insert into public.weekly_bill_allocations (monthly_budget_id, week_start, grocery_bill, vegetable_bill, snacks_bill, notes)
select b.id, v.week_start::date, v.groc, v.veg, 0, v.notes
from public.monthly_budgets b
cross join (values
  ('2026-09-28', 6708.00, 5205.00, 'Bills No. 118 (2,942.50) + No. 119 (2,262.50); Provisions bill 1'),
  ('2026-10-05', 0.00, 3642.50, 'Week 2 vegetables (Cheerakuzhy Stores)'),
  ('2026-10-12', 10258.00, 3485.00, 'Week 3 vegetables; Provisions bill 2 (Maveli Store / stores)'),
  ('2026-10-19', 0.00, 2370.00, 'Week 4 vegetables'),
  ('2026-10-26', 0.00, 3607.70, 'Week 5 vegetables (1,335.00 + 2,272.70)')
) as v(week_start, groc, veg, notes)
where b.month = '2026-10'
on conflict (monthly_budget_id, week_start) do update
  set grocery_bill = excluded.grocery_bill,
      vegetable_bill = excluded.vegetable_bill,
      snacks_bill = excluded.snacks_bill,
      notes = excluded.notes;

commit;
