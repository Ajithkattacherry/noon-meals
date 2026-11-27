# School Meal Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web app where one teacher records weekly ingredient purchases, defines recipes, enters each day's student count and menu, and gets scaled quantities, costs in INR, and cost per child, with finalized days saved as immutable snapshots.

**Architecture:** All money and quantity logic lives in pure TypeScript functions in `src/lib/` (no React, no network), tested first. A thin data layer in `src/data/` talks to Supabase (Postgres plus email/password auth). React screens call the data layer and the pure functions. Finalized days store a full JSON snapshot, and reports read only snapshots.

**Tech Stack:** React + TypeScript (Vite), Vitest, React Testing Library, react-router-dom (HashRouter, for GitHub Pages), `@supabase/supabase-js`, Supabase CLI with pgTAP (`supabase test db`, needs Docker), GitHub Actions, GitHub Pages.

**Spec:** Design doc https://claude.ai/artifact/YBgxAgB7yXrwLCHZj3s7bD and `School_Daily_Meal_Expense_Tracking_SRS_v0.3.docx`. Decisions made in brainstorming and confirmed by the user: price rule is the most recent purchase on or before the menu date (carried-over price is marked); whole-item units round up, weight and volume keep decimals, teacher can override a scaled quantity; buffer percent is optional, default 0, changeable; student count entered fresh each day with the previous day's count pre-filled; one shared account for the MVP (admin and guest accounts are a later step, so keep policies per table and easy to extend); stack is React + Supabase + GitHub Pages.

## Global Constraints

- All money is INR (`₹`), locale `en-IN`; display example `₹100.00`; Indian grouping `₹1,25,000.00`. No currency conversion.
- Dates display as `DD-MMM-YYYY` (example `26-Nov-2026`). Dates are handled as `YYYY-MM-DD` strings, never through local-timezone `Date` conversion.
- Units: Kg, Gram, Liter, Each (plus Millilitre as the Liter-compatible small unit). Every ingredient has exactly one unit.
- Each recipe has a base serving count greater than zero. Every daily record has a student count.
- Cost per child is calculated only when the student count is greater than zero.
- Missing prices and incompatible units are flagged, never treated as zero.
- Finalized days preserve student count, base quantities, scaled quantities, buffer, and prices used; editing a finalized day is explicit and auditable.
- Frontend is React.js, responsive for desktop, tablet and mobile; source on GitHub; free hosting for the frontend.
- Out of scope: inventory/stock, FIFO, multiple roles, notifications, advanced analytics, Excel/PDF export.
- A week runs Monday to Sunday (builder default, change in one place: `weekStart`).

## Review Focus

- Scaled whole-item quantities with floating-point noise (5 Each for 50 children, 100 present, must be exactly 10, not 11). Test in Task 2.
- Student count of 0: no divide-by-zero, cost per child shows as unavailable. Test in Task 4.
- Ingredient whose only purchase is dated after the menu date, or has no purchase at all: flagged as missing price, total marked incomplete, finalize blocked. Test in Tasks 3 and 4.
- Recipe quantity in a different but compatible unit (250 Gram vs ingredient priced per Kg) converts correctly; incompatible (Each vs Kg) is flagged. Test in Tasks 2 and 4.
- Date shown one day off for a developer or user in a US timezone (`2026-11-26` must display `26-Nov-2026`). Test in Task 1.

---

## File Structure

```
src/lib/{types,format,units,scaling,pricing,costing,finalize,reports,menus}.ts   (+ matching .test.ts)
src/data/{supabase,ingredients,purchases,recipes,menus}.ts
src/screens/{Login,Dashboard,Ingredients,Purchases,Recipes,DailyMenu,DailyReview,Reports}.tsx
src/App.tsx
supabase/migrations/0001_init.sql
supabase/tests/schema.test.sql
.github/workflows/{deploy,keepalive}.yml
```

`src/lib` has no imports from React or Supabase. `src/data` is the only place that touches Supabase.

---

### Task 1: Scaffold, shared types, INR and date formatting

**Files:**
- Create: project via `npm create vite@latest . -- --template react-ts`; add `vitest`, `@testing-library/react`, `jsdom`, `react-router-dom`, `@supabase/supabase-js`
- Create: `src/lib/types.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/App.tsx` (HashRouter shell, nav with seven placeholder routes)

**Interfaces:**
- Produces (`types.ts`):
  - `type Unit = 'Kg' | 'Gram' | 'Liter' | 'Millilitre' | 'Each'`
  - `interface Ingredient { id: string; name: string; unit: Unit }`
  - `interface Purchase { id: string; ingredientId: string; purchaseDate: string; unitPrice: number; createdAt: string }` (`unitPrice` is per the ingredient's unit)
  - `interface RecipeItem { ingredientId: string; quantity: number; unit: Unit }`
  - `interface Recipe { id: string; name: string; baseServings: number; items: RecipeItem[] }`
  - `interface PriceRef { purchaseId: string; purchaseDate: string; unitPrice: number; carriedOver: boolean }`
  - `type Flag = { kind: 'missing_price' | 'unit_mismatch'; recipeId: string; ingredientId: string }`
  - `interface CostLine { recipeId: string; ingredientId: string; ingredientName: string; unit: Unit; baseQuantity: number; scaledQuantity: number; overridden: boolean; price: PriceRef | null; cost: number | null }`
  - `interface RecipeCost { recipeId: string; name: string; baseServings: number; lines: CostLine[]; cost: number }`
  - `interface DayCalculation { menuDate: string; studentCount: number; bufferPercent: number; recipes: RecipeCost[]; flags: Flag[]; total: number; complete: boolean; costPerChild: number | null }`
- Produces (`format.ts`): `formatINR(amount: number): string`, `formatDate(isoDate: string): string`, `roundMoney(amount: number): number`

- [ ] **Step 1: Write failing tests in `format.test.ts`:** `formatINR(100)` is `'₹100.00'`; `formatINR(125000)` is `'₹1,25,000.00'`; `formatDate('2026-11-26')` is `'26-Nov-2026'` (also run with `TZ=America/New_York`); `roundMoney(0.125)` is `0.13`.
- [ ] **Step 2: Run** `npx vitest run src/lib/format.test.ts`. Expected: FAIL, functions not defined.
- [ ] **Step 3: Implement** `format.ts`: `formatINR` via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`; `formatDate` by splitting the string and mapping month number to a three-letter name (no `Date` object); `roundMoney` as `Math.round((x + Number.EPSILON) * 100) / 100`. Add `types.ts` as listed.
- [ ] **Step 4: Run** the same command with `TZ=America/New_York`. Expected: PASS. Run `npm run dev` and confirm the shell loads with seven nav links.
- [ ] **Step 5: Commit** `git add -A && git commit -m "chore: scaffold app, types, INR and date formatting"`

---

### Task 2: Unit conversion and recipe scaling

**Files:**
- Create: `src/lib/units.ts`, `src/lib/units.test.ts`, `src/lib/scaling.ts`, `src/lib/scaling.test.ts`

**Interfaces:**
- Consumes: `Unit` from Task 1.
- Produces: `convertQuantity(quantity: number, from: Unit, to: Unit): number | null` (null when incompatible); `scaleQuantity(baseQuantity: number, studentCount: number, baseServings: number, bufferPercent: number, unit: Unit): number`.

- [ ] **Step 1: Write failing tests.**
  - units: `convertQuantity(250, 'Gram', 'Kg')` is `0.25`; `(1, 'Liter', 'Millilitre')` is `1000`; `(3, 'Each', 'Each')` is `3`; `(5, 'Each', 'Kg')` is `null`; `(2, 'Kg', 'Liter')` is `null`.
  - scaling: `scaleQuantity(2, 100, 50, 0, 'Kg')` is `4`; `(0.25, 100, 50, 0, 'Kg')` is `0.5`; `(5, 37, 50, 0, 'Each')` is `4` (3.7 rounds up); `(5, 100, 50, 0, 'Each')` is `10` (not 11); `(2, 100, 50, 10, 'Kg')` is `4.4`; `(1, 1, 3, 0, 'Kg')` is `0.333`.
- [ ] **Step 2: Run** `npx vitest run src/lib/units.test.ts src/lib/scaling.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `convertQuantity`** with a table of factors per family (mass: Kg/Gram, volume: Liter/Millilitre, count: Each); different families return `null`.
- [ ] **Step 4: Implement `scaleQuantity`:** `baseQuantity × (studentCount ÷ baseServings) × (1 + bufferPercent ÷ 100)`; for `Each`, round to 6 decimals first, then `Math.ceil`; for other units round to 3 decimals. Throw if `baseServings <= 0`.
- [ ] **Step 5: Run** the tests. Expected: PASS. Commit `git commit -am "feat: unit conversion and student-based scaling"`.

---

### Task 3: Applicable purchase price lookup

**Files:**
- Create: `src/lib/pricing.ts`, `src/lib/pricing.test.ts`

**Interfaces:**
- Consumes: `Purchase`, `PriceRef`.
- Produces: `weekStart(isoDate: string): string` (Monday of that date's week); `findApplicablePrice(purchases: Purchase[], ingredientId: string, menuDate: string): PriceRef | null`.

- [ ] **Step 1: Write failing tests** using menu date `2026-11-26` (a Thursday; its week starts `2026-11-23`).
  - `weekStart('2026-11-26')` is `'2026-11-23'`; `weekStart('2026-11-29')` (Sunday) is `'2026-11-23'`.
  - Purchase on `2026-11-24`: `carriedOver` is `false`. Purchase on `2026-11-22` (Sunday before): `carriedOver` is `true`.
  - Purchase dated `2026-11-27` only: result is `null`. No purchases for that ingredient: `null`.
  - Purchases on `2026-11-10` (₹40) and `2026-11-17` (₹45): picks ₹45 and returns that purchase's id and date.
  - Two purchases on the same date: the one with the later `createdAt` wins.
  - Purchases of other ingredients are ignored.
- [ ] **Step 2: Run** `npx vitest run src/lib/pricing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions, working on date strings only (compare `YYYY-MM-DD` lexically; compute weekday with `Date.UTC`). Sort by `purchaseDate` then `createdAt`, take the last one not after `menuDate`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: applicable purchase price lookup with carried-over marker"`

---

### Task 4: Daily cost calculation and finalize guard

**Files:**
- Create: `src/lib/costing.ts`, `src/lib/costing.test.ts`, `src/lib/finalize.ts`, `src/lib/finalize.test.ts`

**Interfaces:**
- Consumes: `convertQuantity`, `scaleQuantity`, `findApplicablePrice`, `roundMoney`, all types from Task 1.
- Produces:
  - `computeDay(input: { menuDate: string; studentCount: number; bufferPercent: number; recipes: Recipe[]; ingredients: Ingredient[]; purchases: Purchase[]; overrides?: Record<string, number> }): DayCalculation`. The override key is `` `${recipeId}:${ingredientId}` `` and its value is the final scaled quantity in the ingredient's unit.
  - `canFinalize(calc: DayCalculation): boolean`.

Behaviour: base quantity is converted to the ingredient's unit first (incompatible gives a `unit_mismatch` flag and a null cost); line cost is `roundMoney(scaledQuantity × unitPrice)`; a missing price gives a `missing_price` flag and a null cost; `total` sums priced lines only; `complete` is true only with no flags; `costPerChild` is `roundMoney(total ÷ studentCount)` only when `studentCount > 0` and `complete`, else `null`.

- [ ] **Step 1: Write failing tests** with Vegetable Curry (base 50) using onion 2 Kg, tomato 1 Kg, green chilli 250 Gram, coconut 5 Each; ingredient units Kg, Kg, Kg, Each; purchase unit prices onion ₹40, tomato ₹30, green chilli ₹50.
  - 100 children, no coconut price: onion cost 160, tomato 60, green chilli scaled `0.5` and cost 25, coconut scaled `10` with `price: null` and `cost: null`; `total` is `245`; `flags` has one `missing_price`; `complete` is `false`; `costPerChild` is `null`; `canFinalize` is `false`.
  - Add a coconut purchase at ₹12: `total` is `365`, `complete` is `true`, `costPerChild` is `3.65`, `canFinalize` is `true`.
  - `studentCount` 0: scaled quantities are 0, no error, `costPerChild` is `null`.
  - Green chilli recipe unit `Each` against a Kg ingredient: `unit_mismatch` flag, `cost` `null`.
  - Override of onion to `5` Kg: `overridden` is `true`, cost 200.
  - Buffer 10 percent: onion scaled `4.4`, cost `176`.
  - Two recipes in one day: `total` is the sum of both recipe costs.
- [ ] **Step 2: Run** `npx vitest run src/lib/costing.test.ts src/lib/finalize.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `computeDay` and `canFinalize`** as described above.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: daily cost calculation with flags and finalize guard"`

---

### Task 5: Report aggregation

**Files:**
- Create: `src/lib/reports.ts`, `src/lib/reports.test.ts`

**Interfaces:**
- Consumes: `DayCalculation` (finalized snapshots), `weekStart`.
- Produces:
  - `summarizeByPeriod(snapshots: DayCalculation[], period: 'day' | 'week' | 'month'): { key: string; days: number; studentDays: number; total: number; costPerChild: number | null }[]` (week key is the Monday date, month key is `YYYY-MM`, sorted by key; `costPerChild` is total ÷ student-days).
  - `summarizeByIngredient(snapshots): { ingredientId: string; ingredientName: string; unit: Unit; quantity: number; cost: number }[]`
  - `summarizeByRecipe(snapshots): { recipeId: string; name: string; timesServed: number; cost: number }[]`

- [ ] **Step 1: Write failing tests** with three snapshots: `2026-11-26` (100 children, total 365), `2026-11-29` (80, total 300), `2026-11-30` (90, total 330). Day grouping gives three rows; week grouping puts the first two under `2026-11-23` (total 665, studentDays 180) and the third under `2026-11-30`; month grouping gives one `2026-11` row (total 995, studentDays 270). Ingredient summary adds quantities and costs of the same ingredient across days. Recipe summary counts times served.
- [ ] **Step 2: Run** `npx vitest run src/lib/reports.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions; sum with `roundMoney` at the end.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: report aggregation over finalized snapshots"`

---

### Task 6: Supabase schema, access rules, client and login

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/tests/schema.test.sql`, `src/data/supabase.ts`, `src/screens/Login.tsx`; modify `src/App.tsx` (redirect to Login when signed out)
- Create: `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Interfaces:**
- Produces: tables `ingredients(id, name unique, unit, description, active)`, `purchases(id, ingredient_id, purchase_date, quantity > 0, total_price >= 0, unit_price generated as total_price / quantity, supplier, notes, created_at)`, `recipes(id, name, base_servings int > 0, active)`, `recipe_items(id, recipe_id, ingredient_id, quantity > 0, unit)`, `daily_menus(id, menu_date unique, student_count int >= 0, buffer_percent numeric default 0, overrides jsonb default '{}', status 'draft' | 'finalized', snapshot jsonb, finalized_at)`, `daily_menu_recipes(daily_menu_id, recipe_id)`, `audit_log(id, daily_menu_id, action, reason, before jsonb, at)`. Row-level security on every table with one policy per table for the `authenticated` role (a later guest role is a new read-only policy). `supabase` client export and `useSession(): { session: Session | null; loading: boolean }`.

- [ ] **Step 1: Write failing pgTAP tests** in `schema.test.sql`: inserting a recipe with `base_servings = 0` fails; a second `daily_menus` row with the same `menu_date` fails; a purchase of quantity 10 and total 400 has `unit_price` 40; a query as `anon` on `ingredients` returns no rows.
- [ ] **Step 2: Run** `supabase start && supabase test db`. Expected: FAIL, tables missing.
- [ ] **Step 3: Write the migration** with the tables, checks, unique constraints and policies above.
- [ ] **Step 4: Run** `supabase db reset && supabase test db`. Expected: PASS. Add the client and `Login.tsx` (email and password, `signInWithPassword`, no sign-up UI). In the Supabase dashboard, disable sign-ups and create the one teacher account by hand.
- [ ] **Step 5: Commit** `git commit -am "feat: supabase schema, row-level security, login"`

---

### Task 7: Ingredient management

**Files:**
- Create: `src/data/ingredients.ts`, `src/screens/Ingredients.tsx`, `src/screens/Ingredients.test.tsx`

**Interfaces:**
- Produces: `listIngredients(): Promise<Ingredient[]>`; `saveIngredient(input: { id?: string; name: string; unit: Unit; description?: string; active: boolean }): Promise<Ingredient>`. The screen lists ingredients, adds, edits, and deactivates (inactive ones are hidden from pickers elsewhere, never deleted).

- [ ] **Step 1: Write failing component tests** (data layer mocked with `vi.mock`): form without a unit shows a validation message and does not call `saveIngredient`; a blank name is rejected; deactivating calls `saveIngredient` with `active: false`.
- [ ] **Step 2: Run** `npx vitest run src/screens/Ingredients.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the data functions (map snake_case rows to the `Ingredient` type) and the screen.
- [ ] **Step 4: Run** the tests. Expected: PASS. Manually add Onion (Kg) in the running app and refresh to confirm it persists.
- [ ] **Step 5: Commit** `git commit -am "feat: ingredient management"`

---

### Task 8: Weekly purchase management

**Files:**
- Create: `src/data/purchases.ts`, `src/screens/Purchases.tsx`, `src/screens/Purchases.test.tsx`

**Interfaces:**
- Consumes: `listIngredients`, `formatINR`, `formatDate`.
- Produces: `listPurchases(): Promise<Purchase[]>` (newest first); `addPurchase(input: { ingredientId: string; purchaseDate: string; quantity: number; totalPrice: number; supplier?: string; notes?: string }): Promise<Purchase>`. Purchases are never overwritten; a correction is a new purchase plus a note, or an edit of the same row before any day uses it (builder's choice, keep history intact).

- [ ] **Step 1: Write failing tests:** entering Onion, 10, ₹400 shows `₹40.00/Kg` as the calculated unit price before saving; quantity 0 or negative is rejected; the history list shows dates in `DD-MMM-YYYY`.
- [ ] **Step 2: Run** `npx vitest run src/screens/Purchases.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the data functions and the screen (ingredient picker, date defaults to today as a `YYYY-MM-DD` string built from local parts, history table filterable by ingredient).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: weekly purchase entry and price history"`

---

### Task 9: Recipe management

**Files:**
- Create: `src/data/recipes.ts`, `src/screens/Recipes.tsx`, `src/screens/Recipes.test.tsx`

**Interfaces:**
- Produces: `listRecipes(): Promise<Recipe[]>` (with items); `saveRecipe(input: { id?: string; name: string; baseServings: number; items: RecipeItem[]; active: boolean }): Promise<Recipe>` (replaces the item set in one transaction).

- [ ] **Step 1: Write failing tests:** base serving count 0 is rejected; a recipe with no ingredients is rejected; Vegetable Curry (50) with Onion 2 Kg, Tomato 1 Kg, Green Chilli 250 Gram, Coconut 5 Each saves four items; item unit choices offered for an ingredient measured in Kg are Kg and Gram only.
- [ ] **Step 2: Run** `npx vitest run src/screens/Recipes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the data functions and the screen (item rows, base serving count field).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: recipe management with base serving count"`

---

### Task 10: Daily menu, expense review, finalize and reopen

**Files:**
- Create: `src/lib/menus.ts`, `src/lib/menus.test.ts`, `src/data/menus.ts`, `src/screens/DailyMenu.tsx`, `src/screens/DailyReview.tsx`, `src/screens/DailyReview.test.tsx`

**Interfaces:**
- Consumes: `computeDay`, `canFinalize`, `listRecipes`, `listIngredients`, `listPurchases`.
- Produces:
  - `previousStudentCount(menus: { menuDate: string; studentCount: number }[], menuDate: string): number | null` (count from the latest menu before that date).
  - `getMenuByDate(menuDate: string): Promise<DailyMenu | null>`; `saveDraftMenu(input: { menuDate: string; studentCount: number; bufferPercent: number; recipeIds: string[]; overrides: Record<string, number> }): Promise<DailyMenu>` (upsert by date, refuses if finalized); `finalizeMenu(menuDate: string, calc: DayCalculation): Promise<void>` (stores `calc` as the snapshot, sets `finalized`); `reopenMenu(menuDate: string, reason: string): Promise<void>` (writes the old snapshot and reason to `audit_log`, sets status back to `draft`, rejects an empty reason).

- [ ] **Step 1: Write failing tests.**
  - `previousStudentCount` with menus on 24 and 25 Nov (60 and 70) and date `2026-11-26` is `70`; date before any menu is `null`.
  - Review screen with the Task 4 curry data and no coconut price shows the coconut line flagged and `Finalize` disabled; after a coconut purchase is present it shows `₹365.00` and `₹3.65`, and `Finalize` is enabled.
  - Picking a date that already has a menu opens that menu instead of creating a second one.
  - Carried-over prices show a visible "carried over" marker.
  - Changing the student count re-renders scaled quantities immediately; the override field changes one line and shows it as overridden.
  - Reopen with an empty reason does not call `reopenMenu`.
- [ ] **Step 2: Run** `npx vitest run src/lib/menus.test.ts src/screens/DailyReview.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `previousStudentCount`, the data functions, `DailyMenu.tsx` (date, student count pre-filled from the previous day, buffer percent defaulting to 0, recipe multi-select) and `DailyReview.tsx` (scaled quantities, unit price with marker, line cost, recipe cost, day total, cost per child or "incomplete", Finalize, and Reopen for finalized days).
- [ ] **Step 4: Run** the tests. Expected: PASS. Manually finalize a day, then change a purchase price and confirm the finalized day's numbers do not change.
- [ ] **Step 5: Commit** `git commit -am "feat: daily menu, review, finalize and auditable reopen"`

---

### Task 11: Dashboard and reports screens

**Files:**
- Create: `src/screens/Dashboard.tsx`, `src/screens/Reports.tsx`, `src/screens/Reports.test.tsx`

**Interfaces:**
- Consumes: `summarizeByPeriod`, `summarizeByIngredient`, `summarizeByRecipe`, `getMenuByDate`, `computeDay`, `formatINR`, `formatDate`.

- [ ] **Step 1: Write failing tests:** with the Task 5 snapshots mocked, the Reports screen shows a Day, Week, Month, Ingredient and Recipe tab; the Month tab shows `₹995.00` for `2026-11`; every figure is formatted with `formatINR`; a day with `costPerChild: null` shows an em dash.
- [ ] **Step 2: Run** `npx vitest run src/screens/Reports.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** Reports (finalized snapshots only, date range filter) and Dashboard (today's menu, count, estimate from a live `computeDay`, cost per child, current month summary from snapshots).
- [ ] **Step 4: Run** the tests. Expected: PASS. Check layouts at phone, tablet and desktop widths.
- [ ] **Step 5: Commit** `git commit -am "feat: dashboard and expense reports"`

---

### Task 12: Deployment and keep-alive

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/keepalive.yml`; modify `vite.config.ts` (`base` set to the repository name); add repository secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

- [ ] **Step 1: Write `deploy.yml`:** on push to `main`, run `npm ci`, `npx vitest run`, `npm run build`, then publish `dist` to GitHub Pages.
- [ ] **Step 2: Write `keepalive.yml`:** a weekly scheduled job that makes one request to the Supabase REST endpoint, so the free project is not paused for inactivity.
- [ ] **Step 3: Push to GitHub, enable Pages (GitHub Actions source), and watch the first workflow run.** Expected: both workflows green.
- [ ] **Step 4: Verify on the live URL:** sign in with the teacher account, add an ingredient, refresh, and open the site on a phone to confirm the data is still there.
- [ ] **Step 5: Commit** `git commit -am "ci: deploy to GitHub Pages and weekly Supabase keep-alive"`

---

## Self-Review Notes

- Spec coverage: ingredients (7), purchases and price history (3, 8), recipes with base serving count (9), daily menu and student count with duplicate prevention (6, 10), scaling with buffer (2, 4), cost and cost per child with missing-price flags (4), snapshots and auditable edits (6, 10), reports (5, 11), screens (7 to 11), stack and hosting (6, 12).
- Type names used across tasks: `DayCalculation`, `CostLine`, `PriceRef`, `computeDay`, `canFinalize`, `findApplicablePrice`, `weekStart`, `scaleQuantity`, `convertQuantity`, `formatINR`, `formatDate`, `roundMoney`.
- Known spec gap carried forward: the SRS example total of ₹245 excludes coconut, which has no price; the app treats that as incomplete (Task 4 test).
