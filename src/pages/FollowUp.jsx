import { useState } from 'react';
import { DEFAULT_CATEGORIES } from '../store';

const META = new Set(['_month', '_removedCategories']);

function getCategories(budget) {
  const removed = budget._removedCategories || [];
  return Array.from(new Set([
    ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
    ...Object.keys(budget).filter((k) => !META.has(k) && !DEFAULT_CATEGORIES.includes(k)),
  ]));
}

export default function FollowUp({ budget, expenses, onSaveExpenses, currency, isLocked, lockedBy }) {
  // expenses is now { categoryName: spentAmount } — migrate if old array format
  const savedBalances = Array.isArray(expenses) ? {} : (expenses || {});

  const [balances, setBalances] = useState(() =>
    Object.fromEntries(
      Object.entries(savedBalances).map(([k, v]) => [k, v === 0 ? '' : String(v)])
    )
  );
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const categories = getCategories(budget);
  const sym = currency.symbol;

  function handleChange(cat, value) {
    setBalances((prev) => ({ ...prev, [cat]: value }));
    setSaved(false);
  }

  async function handleSave() {
    const toSave = Object.fromEntries(
      categories.map((cat) => [cat, Math.max(0, Number(balances[cat]) || 0)])
    );
    setSaving(true);
    await onSaveExpenses(toSave);
    setSaving(false);
    setSaved(true);
  }

  const totalBudget = categories.reduce((s, c) => s + (Number(budget[c]) || 0), 0);
  const totalSpent  = categories.reduce((s, c) => s + (Number(balances[c]) || 0), 0);
  const totalLeft   = totalBudget - totalSpent;
  const overallPct  = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="page followup">
      <div className="page-header">
        <h2>Follow-Up</h2>
        <p className="page-subtitle">Update how much you've spent in each category so far.</p>
      </div>

      {isLocked && (
        <div className="lock-banner">
          🔒 {lockedBy} is currently editing — your changes can't be saved.
        </div>
      )}

      {/* Overall summary bar */}
      <div className="card fu-summary">
        <div className="fu-summary-row">
          <div className="fu-summary-stat">
            <span className="fu-stat-label">Budget</span>
            <span className="fu-stat-value">{sym}{totalBudget.toLocaleString()}</span>
          </div>
          <div className="fu-summary-stat">
            <span className="fu-stat-label">Spent</span>
            <span className="fu-stat-value" style={{ color: totalSpent > totalBudget ? 'var(--danger)' : 'var(--text)' }}>
              {sym}{totalSpent.toLocaleString()}
            </span>
          </div>
          <div className="fu-summary-stat">
            <span className="fu-stat-label">Remaining</span>
            <span className="fu-stat-value" style={{ color: totalLeft < 0 ? 'var(--danger)' : 'var(--success)' }}>
              {totalLeft < 0 ? '-' : ''}{sym}{Math.abs(totalLeft).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="fu-overall-track">
          <div
            className="fu-overall-fill"
            style={{
              width: `${overallPct}%`,
              background: overallPct >= 100 ? 'var(--danger)' : overallPct >= 80 ? '#f59e0b' : 'var(--accent)',
            }}
          />
        </div>
      </div>

      {/* Category cards */}
      <div className="fu-cat-list">
        {categories.map((cat) => {
          const budgeted = Number(budget[cat]) || 0;
          const spent    = Math.max(0, Number(balances[cat]) || 0);
          const left     = budgeted - spent;
          const pct      = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
          const over     = spent > budgeted;

          return (
            <div key={cat} className="card fu-cat-card">
              <div className="fu-cat-top">
                <span className="fu-cat-name">{cat}</span>
                <span className="fu-cat-budget">of {sym}{budgeted.toLocaleString()}</span>
              </div>

              <div className="fu-cat-track">
                <div
                  className="fu-cat-fill"
                  style={{
                    width: `${pct}%`,
                    background: over ? 'var(--danger)' : pct >= 80 ? '#f59e0b' : 'var(--accent)',
                  }}
                />
              </div>

              <div className="fu-cat-bottom">
                <div className="fu-cat-input-wrap">
                  <span className="currency-symbol">{sym}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={balances[cat] ?? ''}
                    onChange={(e) => handleChange(cat, e.target.value)}
                    className="amount-input fu-cat-input"
                    disabled={isLocked}
                  />
                </div>
                <span className="fu-cat-left" style={{ color: over ? 'var(--danger)' : 'var(--success)' }}>
                  {over ? 'Over by ' : 'Left: '}
                  {sym}{Math.abs(left).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fu-save-row">
        {saved && <span className="saved-msg">Saved!</span>}
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={saving || isLocked}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
