import { useState, useEffect } from 'react';
import { DEFAULT_CATEGORIES } from '../store';

export default function Planning({ budget: initialBudget, onSaveBudget, currency }) {
  const [budget, setBudget] = useState(initialBudget);
  const [newCategory, setNewCategory] = useState('');
  const [month, setMonth] = useState(() => {
    if (initialBudget._month) return initialBudget._month;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Sync if parent reloads budget (e.g. after sign-in)
  useEffect(() => {
    setBudget(initialBudget);
    if (initialBudget._month) setMonth(initialBudget._month);
  }, [initialBudget]);

  const removed = budget._removedCategories || [];

  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
    ...Object.keys(budget).filter(
      (k) => !['_month', '_removedCategories'].includes(k) && !DEFAULT_CATEGORIES.includes(k)
    ),
  ]));

  function handleAmountChange(cat, value) {
    setBudget((prev) => ({ ...prev, [cat]: value }));
    setSaved(false);
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setBudget((prev) => ({ ...prev, [trimmed]: '' }));
    setNewCategory('');
    setSaved(false);
  }

  function handleRemoveCategory(cat) {
    setSaved(false);
    if (DEFAULT_CATEGORIES.includes(cat)) {
      setBudget((prev) => ({
        ...prev,
        _removedCategories: [...(prev._removedCategories || []), cat],
      }));
    } else {
      setBudget((prev) => {
        const next = { ...prev };
        delete next[cat];
        return next;
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    await onSaveBudget({ ...budget, _month: month });
    setSaving(false);
    setSaved(true);
  }

  const total = categories.reduce((sum, cat) => sum + (Number(budget[cat]) || 0), 0);

  return (
    <div className="page planning">
      <div className="page-header">
        <h2>Monthly Budget Plan</h2>
        <p className="page-subtitle">Set your spending targets for each category.</p>
      </div>

      <div className="planning-month">
        <label htmlFor="month-input">Planning Month</label>
        <input
          id="month-input"
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setSaved(false); }}
          className="month-input"
        />
      </div>

      <div className="category-list">
        {categories.map((cat) => (
          <div key={cat} className="category-row">
            <span className="category-name">{cat}</span>
            <div className="category-input-wrap">
              <span className="currency-symbol">{currency.symbol}</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={budget[cat] ?? ''}
                onChange={(e) => handleAmountChange(cat, e.target.value)}
                className="amount-input"
              />
            </div>
            <button
              className="remove-btn"
              onClick={() => handleRemoveCategory(cat)}
              title="Remove category"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="add-category">
        <input
          type="text"
          placeholder="New category name..."
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          className="new-cat-input"
        />
        <button className="btn btn--secondary" onClick={handleAddCategory}>
          + Add Category
        </button>
      </div>

      <div className="planning-footer">
        <div className="total-bar">
          <span>Total Budget</span>
          <span className="total-amount">{currency.symbol}{total.toLocaleString()}</span>
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Plan'}
        </button>
        {saved && <span className="saved-msg">Saved!</span>}
      </div>
    </div>
  );
}
