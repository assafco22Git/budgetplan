import { useState } from 'react';
import { DEFAULT_CATEGORIES } from '../store';

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FollowUp({ budget, expenses, onSaveExpenses, currency }) {
  const [weekDate, setWeekDate] = useState(() => {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    return sunday.toISOString().slice(0, 10);
  });
  const [amounts,   setAmounts]   = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  const removed = budget._removedCategories || [];
  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
    ...Object.keys(budget).filter(
      (k) => !['_month', '_removedCategories'].includes(k) && !DEFAULT_CATEGORIES.includes(k)
    ),
  ]));

  function handleAmountChange(cat, value) {
    setAmounts((prev) => ({ ...prev, [cat]: value }));
    setSaved(false);
  }

  async function handleSubmit() {
    if (!weekDate) return;
    const entry = {
      id: editingId || Date.now().toString(),
      weekOf: weekDate,
      amounts: Object.fromEntries(
        Object.entries(amounts).map(([k, v]) => [k, Number(v) || 0])
      ),
    };
    let updated;
    if (editingId) {
      updated = expenses.map((e) => (e.id === editingId ? entry : e));
      setEditingId(null);
    } else {
      updated = [...expenses, entry];
    }
    updated.sort((a, b) => a.weekOf.localeCompare(b.weekOf));
    setSaving(true);
    await onSaveExpenses(updated);
    setSaving(false);
    setAmounts({});
    setSaved(true);
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setWeekDate(entry.weekOf);
    setAmounts(
      Object.fromEntries(
        Object.entries(entry.amounts).map(([k, v]) => [k, v === 0 ? '' : String(v)])
      )
    );
    setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    const updated = expenses.filter((e) => e.id !== id);
    await onSaveExpenses(updated);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setAmounts({});
    setSaved(false);
  }

  const sym = currency.symbol;
  const entryTotal = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="page followup">
      <div className="page-header">
        <h2>{editingId ? 'Edit Weekly Expenses' : 'Log Weekly Expenses'}</h2>
        <p className="page-subtitle">Enter what you spent during the past week.</p>
      </div>

      <div className="followup-form card">
        <div className="form-week">
          <label htmlFor="week-input">Week ending (Sunday)</label>
          <input
            id="week-input"
            type="date"
            value={weekDate}
            onChange={(e) => { setWeekDate(e.target.value); setSaved(false); }}
            className="date-input"
          />
        </div>

        <div className="category-list">
          {categories.map((cat) => (
            <div key={cat} className="category-row">
              <span className="category-name">{cat}</span>
              <div className="category-input-wrap">
                <span className="currency-symbol">{sym}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={amounts[cat] ?? ''}
                  onChange={(e) => handleAmountChange(cat, e.target.value)}
                  className="amount-input"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="followup-footer">
          <div className="total-bar">
            <span>Week Total</span>
            <span className="total-amount">
              {sym}{entryTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="btn-row">
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Entry' : 'Save Entry'}
            </button>
            {editingId && (
              <button className="btn btn--ghost" onClick={handleCancelEdit}>Cancel</button>
            )}
          </div>
          {saved && <span className="saved-msg">Entry saved!</span>}
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="expense-history">
          <h3>Past Entries</h3>
          <div className="history-list">
            {[...expenses].reverse().map((entry) => {
              const total = Object.values(entry.amounts).reduce((s, v) => s + v, 0);
              return (
                <div key={entry.id} className="history-card card">
                  <div className="history-card-header">
                    <span className="history-date">Week of {getWeekLabel(entry.weekOf)}</span>
                    <span className="history-total">
                      {sym}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="history-amounts">
                    {Object.entries(entry.amounts)
                      .filter(([, v]) => v > 0)
                      .map(([cat, val]) => (
                        <span key={cat} className="history-chip">
                          {cat}: {sym}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ))}
                  </div>
                  <div className="history-actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(entry)}>Edit</button>
                    <button className="btn btn--danger btn--sm" onClick={() => handleDelete(entry.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
