import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase, useSession } from './data/supabase'
import { todayISO } from './lib/format'
import Dashboard from './screens/Dashboard'
import DailyMenu from './screens/DailyMenu'
import DailyReview from './screens/DailyReview'
import BudgetPlanner from './screens/BudgetPlanner'
import Ingredients from './screens/Ingredients'
import Login from './screens/Login'
import Purchases from './screens/Purchases'
import Recipes from './screens/Recipes'
import Reports from './screens/Reports'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              NM
            </span>
            <div>
              <strong>Noon Meals</strong>
              <span className="brand-subtitle">School meal expense tracker</span>
            </div>
          </div>

          <nav className="app-nav" aria-label="Main">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/ingredients">Ingredients</NavLink>
            <NavLink to="/purchases">Purchases</NavLink>
            <NavLink to="/recipes">Recipes</NavLink>
            <NavLink to="/daily">Daily menu</NavLink>
            <NavLink to={`/review/${todayISO()}`}>Today’s review</NavLink>
            <NavLink to="/budget">Budget planner</NavLink>
            <NavLink to="/reports">Reports</NavLink>
          </nav>

          <button
            type="button"
            className="btn btn-ghost btn-sm sign-out"
            onClick={() => {
              void supabase?.auth.signOut()
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  )
}

export default function App() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="app-loading" role="status">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ingredients" element={<Ingredients />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/daily" element={<DailyMenu />} />
          <Route path="/review/:menuDate" element={<DailyReview />} />
          <Route path="/budget" element={<BudgetPlanner />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  )
}
