import { useState, useEffect } from 'react';
import Planning from './pages/Planning';
import FollowUp from './pages/FollowUp';
import Dashboard from './pages/Dashboard';
import { CURRENCIES, getCurrency, saveCurrency, getTheme, saveTheme } from './store';
import './App.css';

const PAGES = ['Home', 'Plan', 'Follow-Up'];

export default function App() {
  const [page, setPage] = useState('Home');
  const [currencyCode, setCurrencyCode] = useState(getCurrency);
  const [theme, setTheme] = useState(getTheme);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
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
        </div>
      </header>
      <main className="app-main">
        {page === 'Home' && <Dashboard currency={currency} />}
        {page === 'Plan' && <Planning currency={currency} />}
        {page === 'Follow-Up' && <FollowUp currency={currency} />}
      </main>
    </div>
  );
}
