# Monthly Budget & Weekly Bill Planner — Feature Plan

**Goal:** Add top-down monthly target budgeting and menu-driven weekly bill planning to the School Meal Expense Tracker, so the teacher can start from the month-end portal figure (`siteAmount`), plan a monthly target total, deduct fixed monthly bills (Rice, Transportation, Gas), and allocate the remaining budget across weekly **Grocery (പലചരക്ക്)** and **Vegetable (പച്ചക്കറി)** bills based on each week's Monday–Friday menu.

**Architecture:** Follows the existing separation of concerns:
- Pure TypeScript calculation and aggregation functions in `src/lib/budget.ts` (no React, no Supabase), unit-tested first.
- Database schema extension in `supabase/migrations/0002_monthly_budget_planner.sql` with RLS policies matching the existing `authenticated`-only model.
- Thin data layer in `src/data/budgets.ts` (plus `category` support in `src/data/ingredients.ts`).
- New `BudgetPlanner` screen (`src/screens/BudgetPlanner.tsx`) wired into `src/App.tsx` (`/budget`) and surfaced on `Dashboard.tsx`.

---

## Domain Model & Business Rules

1. **Ingredient Categories (`IngredientCategory`)**
   - Every ingredient gets a `category`: `'fixed' | 'grocery' | 'vegetable' | 'snacks'` (default `'grocery'` for existing rows).
   - Examples:
     - `fixed`: Rice (അരി), Cooking Gas, Transportation
     - `vegetable`: Onion (സവാള), Green Chilli (പച്ചമുളക്), Garlic (വെളുത്തുള്ളി), Tamarind (വാളംപുളി/പുളി), Sambar vegetables
     - `grocery`: Dal, Oil, Spices, Pulses
     - `snacks`: Snack items (പലഹാരങ്ങൾ) — tracked distinctly in the weekly list and optionally included in Grocery or shown as its own line.

2. **Monthly Budget (`MonthlyBudget`)**
   - Keyed uniquely by `month` (`YYYY-MM`, e.g. `2026-11`).
   - `siteAmount`: optional reference amount from the official portal (the red month-end figure).
   - `plannedTarget`: the planned total monthly expense figure in INR (`>= 0`).
   - `fixedBills`: list of actual non-negotiable bills for the month (`label`, `billDate`, `amount`, `notes`) — e.g. monthly Rice bill, Transportation charge, Gas bill(s).
   - `distributableBudget = roundMoney(plannedTarget - sum(fixedBills))`.

3. **Weekly Menu & Bill Allocation (`WeeklyBillAllocation`)**
   - Keyed by `(monthlyBudgetId, weekStart)` where `weekStart` is the Monday `YYYY-MM-DD` of each week overlapping the month.
   - **Menu-driven Weekly Curry/Ingredient List (Mon–Fri):**
     - Reads `daily_menus` (Monday through Friday of that `weekStart`) and expands their selected `recipes` and `studentCount`.
     - Groups required ingredients by `category` (`vegetable`, `grocery`, `snacks`) so the teacher can review the week's curry list and estimated purchase cost before setting the weekly bills.
   - **Weekly Bill Inputs:**
     - `groceryBill`: planned/set Grocery bill amount in INR (`>= 0`).
     - `vegetableBill`: planned/set Vegetable bill amount in INR (`>= 0`).
     - `snacksBill`: optional planned/set Snacks bill amount in INR (`>= 0`, default `0`).
     - `notes`: optional notes (e.g. menu adjustments).

4. **Monthly Target Reconciliation**
   - `totalFixed = sum(fixedBills.amount)`
   - `totalWeeklyAllocated = sum(weeklyAllocations.groceryBill + vegetableBill + snacksBill)`
   - `totalPlanned = roundMoney(totalFixed + totalWeeklyAllocated)`
   - `remainingToAllocate = roundMoney(plannedTarget - totalPlanned)`
   - When `remainingToAllocate === 0`, the monthly plan is balanced to the exact target. Positive values show how much budget remains for upcoming weeks; negative values flag over-allocation.

---

## File Structure

```text
supabase/migrations/0002_monthly_budget_planner.sql
supabase/tests/budget.test.sql
src/lib/types.ts                  (extend with IngredientCategory, MonthlyBudget, FixedBill, WeeklyBillAllocation, BudgetSummary)
src/lib/budget.ts                 (pure calculations: week list for month, Mon–Fri menu ingredient grouping, reconciliation)
src/lib/budget.test.ts
src/data/ingredients.ts           (include category in list/save)
src/data/budgets.ts               (CRUD for monthly_budgets, monthly_fixed_bills, weekly_bill_allocations)
src/screens/Ingredients.tsx       (add Category selector & filter)
src/screens/BudgetPlanner.tsx     (monthly target, fixed bills, weekly Mon–Fri menu breakdown, weekly bill inputs, variance bar)
src/screens/BudgetPlanner.test.tsx
src/screens/Dashboard.tsx         (add current-month budget status summary card)
src/App.tsx                       (add "Budget planner" nav link and /budget route)
```

---

## Implementation Tasks

### Task 1: Domain types & pure budget calculation logic (`src/lib/budget.ts`)
- [ ] Extend `src/lib/types.ts` with `IngredientCategory`, `FixedBill`, `WeeklyBillAllocation`, `MonthlyBudget`, and `MonthlyBudgetSummary`.
- [ ] Implement `weeksInMonth(month: string): string[]` returning Monday `YYYY-MM-DD` strings for weeks that have school days (Mon–Fri) in `month`.
- [ ] Implement `summarizeWeekIngredients(menus, recipes, ingredients, purchases, weekStart)`:
  - Filters `menus` to Monday–Friday of `weekStart`.
  - Uses `computeDay` (or equivalent scaling) to aggregate quantities and estimated costs per ingredient, grouped into `vegetable`, `grocery`, and `snacks`.
- [ ] Implement `reconcileMonthlyBudget(budget, fixedBills, weeklyAllocations)`:
  - Computes `totalFixed`, `distributableBudget`, `totalGrocery`, `totalVegetable`, `totalSnacks`, `totalWeeklyAllocated`, `totalPlanned`, and `remainingToAllocate` using `roundMoney`.
- [ ] Write unit tests in `src/lib/budget.test.ts` covering:
  - Fixed bill deduction and negative/zero remaining balance handling.
  - Multi-week allocation summing exactly to `plannedTarget` (`remainingToAllocate === 0`).
  - Over-budget detection (`remainingToAllocate < 0`).
  - Monday–Friday menu aggregation grouped by `vegetable` vs `grocery` vs `snacks`.

### Task 2: Supabase migration & pgTAP tests
- [ ] Create `supabase/migrations/0002_monthly_budget_planner.sql`:
  - `alter table public.ingredients add column category text not null default 'grocery' check (category in ('fixed', 'grocery', 'vegetable', 'snacks'));`
  - `public.monthly_budgets(id, month unique, site_amount, planned_target, notes, created_at, updated_at)`
  - `public.monthly_fixed_bills(id, monthly_budget_id, label, bill_date, amount, notes, created_at)`
  - `public.weekly_bill_allocations(id, monthly_budget_id, week_start, grocery_bill, vegetable_bill, snacks_bill, notes, updated_at, unique(monthly_budget_id, week_start))`
  - Enable RLS and add `authenticated` policies + grants matching `0001_init.sql`.
- [ ] Add pgTAP assertions in `supabase/tests/budget.test.sql` (invalid category rejected, duplicate month rejected, negative bill amount rejected, `anon` gets zero rows).

### Task 3: Data layer (`src/data/ingredients.ts`, `src/data/budgets.ts`)
- [ ] Update `src/data/ingredients.ts` to read and write `category`.
- [ ] Create `src/data/budgets.ts`:
  - `getMonthlyBudget(month: string)` (loads budget, its fixed bills, and its weekly allocations)
  - `saveMonthlyBudgetTarget(input: { month: string; siteAmount?: number | null; plannedTarget: number; notes?: string | null })`
  - `saveFixedBill(input)` & `deleteFixedBill(id)`
  - `saveWeeklyAllocation(input)`

### Task 4: Ingredients category UI (`src/screens/Ingredients.tsx`)
- [ ] Add a `Category` dropdown (`Fixed`, `Grocery`, `Vegetable`, `Snacks`) to the ingredient form and display/filter by category in the ingredients table.
- [ ] Update `src/screens/Ingredients.test.tsx`.

### Task 5: Budget Planner screen & Dashboard summary (`src/screens/BudgetPlanner.tsx`, `src/screens/Dashboard.tsx`, `src/App.tsx`)
- [ ] Build `BudgetPlanner.tsx` with:
  - **Month selector** (`YYYY-MM`, defaulting to current month).
  - **Target & Reconciliation Header**: Site Reference Amount, Planned Target input, Total Fixed Bills, Distributable Budget, Allocated Weekly Bills, and Remaining/Variance badge.
  - **Fixed Bills Card**: Add/edit/delete monthly one-off bills (Rice, Transportation, Gas, etc.).
  - **Weekly Menu & Bill Allocation Cards**: One card per week (Mon–Fri) showing:
    - The week's served/planned recipes by day (Mon–Fri) and grouped ingredient list (`Vegetable`, `Grocery`, `Snacks`) with estimated cost from purchases.
    - Editable inputs for **Grocery Bill**, **Vegetable Bill**, and **Snacks Bill** with instant live variance recalculation against the monthly target.
- [ ] Add `/budget` route and `Budget planner` nav link in `src/App.tsx`.
- [ ] Add a compact current-month budget progress summary on `Dashboard.tsx`.
- [ ] Write component tests in `src/screens/BudgetPlanner.test.tsx` and run `npx vitest run` + `npm run build` to verify everything passes.
