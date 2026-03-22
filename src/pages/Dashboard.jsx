import { useEffect, useState } from 'react';
import { getBudget, getExpenses, getTotalSpentByCategory, DEFAULT_CATEGORIES } from '../store';

function ProgressBar({ pct, status }) {
  return (
    <div className="progress-track">
      <div
        className={`progress-fill progress-fill--${status}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function getStatus(spent, budget) {
  if (budget <= 0) return 'none';
  const pct = spent / budget;
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'good';
}

export default function Dashboard({ currency }) {
  const [budget, setBudget] = useState({});
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    setBudget(getBudget());
    setExpenses(getExpenses());
  }, []);

  const removed = budget._removedCategories || [];

  const categories = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
      ...Object.keys(budget).filter(
        (k) => !['_month', '_removedCategories'].includes(k) && !DEFAULT_CATEGORIES.includes(k)
      ),
    ])
  );

  const spentByCategory = getTotalSpentByCategory(expenses);

  const rows = categories
    .map((cat) => {
      const target = Number(budget[cat]) || 0;
      const spent = spentByCategory[cat] || 0;
      const remaining = target - spent;
      const pct = target > 0 ? (spent / target) * 100 : 0;
      const status = getStatus(spent, target);
      return { cat, target, spent, remaining, pct, status };
    })
    .filter((r) => r.target > 0 || r.spent > 0);

  const totalBudget = rows.reduce((s, r) => s + r.target, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overallStatus = getStatus(totalSpent, totalBudget);

  const month = budget._month
    ? new Date(budget._month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const sym = currency.symbol;

  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (rows.length === 0) {
    return (
      <div className="page dashboard">
        <div className="page-header">
          <h2>Home</h2>
        </div>
        <div className="empty-state card">
          <div className="empty-icon">📊</div>
          <p>No budget plan found. Go to <strong>Plan</strong> to set your monthly targets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard">
      <div className="page-header">
        <h2>Home</h2>
        {month && <p className="page-subtitle">{month}</p>}
      </div>

      <div className="summary-cards">
        <div className="summary-card card">
          <span className="summary-label">Total Budget</span>
          <span className="summary-value">{sym}{totalBudget.toLocaleString()}</span>
        </div>
        <div className="summary-card card">
          <span className="summary-label">Total Spent</span>
          <span className={`summary-value summary-value--${overallStatus}`}>
            {sym}{fmt(totalSpent)}
          </span>
        </div>
        <div className={`summary-card card ${totalRemaining < 0 ? 'card--danger' : ''}`}>
          <span className="summary-label">Remaining</span>
          <span className={`summary-value summary-value--${overallStatus}`}>
            {totalRemaining < 0 ? '-' : ''}{sym}{fmt(Math.abs(totalRemaining))}
          </span>
        </div>
      </div>

      <div className="overall-progress card">
        <div className="overall-progress-header">
          <span>Overall Budget Used</span>
          <span className={`pct-label pct-label--${overallStatus}`}>{overallPct.toFixed(1)}%</span>
        </div>
        <ProgressBar pct={overallPct} status={overallStatus} />
      </div>

      <div className="breakdown">
        <h3>Category Breakdown</h3>
        <div className="breakdown-list">
          {rows.map(({ cat, target, spent, remaining, pct, status }) => (
            <div key={cat} className="breakdown-card card">
              <div className="breakdown-top">
                <span className="breakdown-cat">{cat}</span>
                <span className={`pct-label pct-label--${status}`}>
                  {target > 0 ? `${pct.toFixed(0)}%` : '—'}
                </span>
              </div>
              {target > 0 && <ProgressBar pct={pct} status={status} />}
              <div className="breakdown-nums">
                <span className="num-spent">Spent: <strong>{sym}{fmt(spent)}</strong></span>
                <span className="num-divider">/</span>
                <span className="num-budget">Budget: <strong>{sym}{target.toLocaleString()}</strong></span>
                <span className={`num-remaining num-remaining--${status}`}>
                  {remaining >= 0
                    ? `${sym}${fmt(remaining)} left`
                    : `${sym}${fmt(Math.abs(remaining))} over`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
