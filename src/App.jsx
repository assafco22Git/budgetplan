import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import Planning from './pages/Planning';
import FollowUp from './pages/FollowUp';
import Dashboard from './pages/Dashboard';
import LoginScreen from './components/LoginScreen';
import {
  CURRENCIES, getCurrency, saveCurrency,
  getTheme, saveTheme,
  loadUserData, saveUserBudget, saveUserExpenses,
} from './store';
import './App.css';

const PAGES = ['Home', 'Plan', 'Follow-Up'];

export default function App() {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError]     = useState('');

  const [budget,   setBudget]   = useState({});
  const [expenses, setExpenses] = useState([]);

  const [page,         setPage]         = useState('Home');
  const [currencyCode, setCurrencyCode] = useState(getCurrency);
  const [theme,        setTheme]        = useState(getTheme);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Watch Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setDataLoading(true);
        const data = await loadUserData(firebaseUser.uid);
        setBudget(data.budget);
        setExpenses(data.expenses);
        setDataLoading(false);
      } else {
        setBudget({});
        setExpenses([]);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  async function handleSignIn() {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Sign-in failed. Please try again.');
      }
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setPage('Home');
  }

  async function handleSaveBudget(newBudget) {
    setBudget(newBudget);
    await saveUserBudget(user.uid, newBudget);
  }

  async function handleSaveExpenses(newExpenses) {
    setExpenses(newExpenses);
    await saveUserExpenses(user.uid, newExpenses);
  }

  function handleCurrencyChange(e) {
    const code = e.target.value;
    saveCurrency(code);
    setCurrencyCode(code);
  }

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    setTheme(next);
  }

  // ── Loading / auth gates ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">BudgetPlan</div>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSignIn={handleSignIn} error={authError} />;
  }

  if (dataLoading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">BudgetPlan</div>
        <div className="spinner" />
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">BudgetPlan</h1>
        <nav className="app-nav">
          {PAGES.map((p) => (
            <button
              key={p}
              className={`nav-btn ${page === p ? 'nav-btn--active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="header-controls">
          <select
            className="currency-select"
            value={currencyCode}
            onChange={handleCurrencyChange}
            aria-label="Select currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <button
            className="theme-toggle"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="user-btn"
            onClick={handleSignOut}
            title={`Signed in as ${user.displayName || user.email}\nClick to sign out`}
          >
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
              : <span className="user-initial">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
            }
          </button>
        </div>
      </header>
      <main className="app-main">
        {page === 'Home'      && <Dashboard budget={budget} expenses={expenses} currency={currency} />}
        {page === 'Plan'      && <Planning  budget={budget} onSaveBudget={handleSaveBudget} currency={currency} />}
        {page === 'Follow-Up' && <FollowUp  budget={budget} expenses={expenses} onSaveExpenses={handleSaveExpenses} currency={currency} />}
      </main>
    </div>
  );
}
