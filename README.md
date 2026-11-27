# Noon Meals — School Meal Expense Tracker

A web app for a school teacher to record weekly ingredient purchases, define recipes,
enter each day's student count and menu, and see scaled quantities, costs in INR and
cost per child. Finalized days are stored as immutable snapshots.

## Stack

React + TypeScript (Vite) · Vitest + React Testing Library · react-router-dom
(HashRouter, for GitHub Pages) · Supabase (Postgres + email/password auth) · GitHub
Pages.

## Local setup

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase URL and anon key
npm run dev
```

### Supabase (first time)

```bash
npm install -g supabase
supabase init                  # creates supabase/config.toml (keep the migrations)
supabase start                 # needs Docker
supabase db reset              # applies supabase/migrations/0001_init.sql
supabase test db               # runs supabase/tests/schema.test.sql (pgTAP)
```

Then, in the Supabase dashboard:

1. Turn **off** new user sign-ups (Authentication → Providers → Email).
2. Create the one shared teacher account by hand (Authentication → Users → Add user).
3. Put the project URL and anon key into `.env.local` (and into the GitHub repository
   secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for deployment).

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Vite dev server                           |
| `npm test`          | Run all unit/component tests once         |
| `npm run test:watch`| Watch mode                                |
| `npm run typecheck` | TypeScript, no emit                       |
| `npm run build`     | Typecheck + production build to `dist/`   |

## Architecture

```
src/lib/       Pure TypeScript: types, formatting, units, scaling, pricing,
               costing, finalize guard, reports, menu helpers. No React, no network.
src/data/      The only place that talks to Supabase (snake_case ↔ camelCase mapping).
src/screens/   React screens; they call src/data and src/lib.
supabase/      SQL migration (tables, RLS, transactional RPCs) and pgTAP tests.
```

### Rules baked into the logic

- Money is INR, `en-IN` grouping (`₹1,25,000.00`). Dates are `YYYY-MM-DD` strings
  displayed as `DD-MMM-YYYY`, never converted through a local-timezone `Date`.
- Units: Kg/Gram (mass), Liter/Millilitre (volume), Each (count). Incompatible units
  are flagged, never converted.
- Price rule: the most recent purchase **on or before** the menu date. A purchase from
  an earlier week is shown as **carried over**. No purchase means *missing price*,
  never zero.
- Scaling: `base × students ÷ baseServings × (1 + buffer ÷ 100)`. Whole items
  (`Each`) round up after trimming float noise, so 5 Each for 100 children from a
  50-serving recipe is exactly 10, not 11. Weight/volume keep three decimals.
- A day can only be finalized when nothing is flagged. Finalizing stores a full JSON
  snapshot; reports read snapshots only. Reopening requires a reason and writes the
  old snapshot and reason to `audit_log`.
- Student count 0 is allowed: quantities are 0 and cost per child is unavailable
  (never a divide-by-zero).

## Deployment

Push to `main`; `.github/workflows/deploy.yml` runs the tests, builds, and publishes
`dist` to GitHub Pages (enable Pages → Source: GitHub Actions). `vite.config.ts` uses
`base: './'` with `HashRouter`, so the app works under any repository sub-path.

`.github/workflows/keepalive.yml` pings the Supabase REST endpoint weekly so the free
project does not pause for inactivity.
