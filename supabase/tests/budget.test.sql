begin;
select plan(4);

-- 1. Invalid ingredient category is rejected
select throws_ok(
  $$insert into public.ingredients (name, unit, category) values ('BadCat', 'Kg', 'invalid')$$,
  null,
  null,
  'rejects invalid ingredient category'
);

-- 2. Duplicate monthly_budgets.month is rejected
insert into public.monthly_budgets (month, planned_target) values ('2026-11', 50000);
select throws_ok(
  $$insert into public.monthly_budgets (month, planned_target) values ('2026-11', 60000)$$,
  '23505',
  null,
  'rejects duplicate month in monthly_budgets'
);

-- 3. Negative fixed bill amount is rejected
select throws_ok(
  $$insert into public.monthly_fixed_bills (monthly_budget_id, label, bill_date, amount)
    select id, 'Gas', '2026-11-05', -100 from public.monthly_budgets where month = '2026-11'$$,
  null,
  null,
  'rejects negative fixed bill amount'
);

-- 4. Anon role sees zero rows in monthly_budgets
set local role anon;
select is((select count(*)::int from public.monthly_budgets), 0, 'anon sees zero monthly_budgets rows');

select * from finish();
rollback;
