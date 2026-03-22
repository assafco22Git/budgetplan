import { useState, useRef } from 'react';
import { DEFAULT_CATEGORIES } from '../store';


const META_KEYS = new Set(['_removedCategories', '_month']);

function getCategories(budget) {
  const removed = budget._removedCategories || [];
  return Array.from(new Set([
    ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
    ...Object.keys(budget).filter((k) => !META_KEYS.has(k) && !DEFAULT_CATEGORIES.includes(k)),
  ]));
}

export default function Planning({ budget: initialBudget, onSaveBudget, currency, isLocked, lockedBy }) {
  const [budget,      setBudget]      = useState(() => ({ ...initialBudget }));
  const [newCategory, setNewCategory] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [editingCat,  setEditingCat]  = useState(null);
  const [editCatVal,  setEditCatVal]  = useState('');

  const newCatRef = useRef(null);
  const categories = getCategories(budget);

  function setAmount(cat, value) {
    const num = Math.max(0, Number(value) || 0);
    setBudget((prev) => ({ ...prev, [cat]: num }));
    setSaved(false);
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setBudget((prev) => {
      if (getCategories(prev).includes(name)) return prev;
      return { ...prev, [name]: 0 };
    });
    setNewCategory('');
    setSaved(false);
    newCatRef.current?.focus();
  }

  function removeCategory(cat) {
    if (DEFAULT_CATEGORIES.includes(cat)) {
      setBudget((prev) => ({
        ...prev,
        _removedCategories: [...(prev._removedCategories || []), cat],
      }));
    } else {
      setBudget((prev) => { const n = { ...prev }; delete n[cat]; return n; });
    }
    setSaved(false);
    newCatRef.current?.focus();
  }

  function startRename(cat) { setEditingCat(cat); setEditCatVal(cat); }

  function confirmRename(oldName) {
    const newName = editCatVal.trim();
    setEditingCat(null);
    if (!newName || newName === oldName) return;
    if (getCategories(budget).some((c) => c !== oldName && c === newName)) return;
    const val = budget[oldName] ?? 0;
    setBudget((prev) => {
      const n = { ...prev };
      if (DEFAULT_CATEGORIES.includes(oldName)) {
        n._removedCategories = [...(prev._removedCategories || []), oldName];
      } else {
        delete n[oldName];
      }
      n[newName] = val;
      return n;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const toSave = { ...budget };
    delete toSave._month;
    await onSaveBudget(toSave);
    setSaving(false);
    setSaved(true);
  }

  const total = categories.reduce((s, c) => s + (Number(budget[c]) || 0), 0);
  const sym = currency.symbol;

  return (
    <div className="page planning">
      <div className="page-header">
        <h2>Monthly Budget</h2>
        <p className="page-subtitle">Set once — applied every month automatically.</p>
      </div>

      {isLocked && (
        <div className="lock-banner">
          🔒 {lockedBy} is currently editing — your changes can't be saved.
        </div>
      )}

      <div className="plan-category-list">
        {categories.map((cat) => {
          const val = Number(budget[cat]) || 0;
          return (
            <div key={cat} className="plan-cat-card card">
              <div className="plan-cat-header">
                {editingCat === cat ? (
                  <input
                    className="cat-edit-input"
                    value={editCatVal}
                    autoFocus
                    onChange={(e) => setEditCatVal(e.target.value)}
                    onBlur={() => confirmRename(cat)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  confirmRename(cat);
                      if (e.key === 'Escape') setEditingCat(null);
                    }}
                  />
                ) : (
                  <span className="plan-cat-name">{cat}</span>
                )}
                <div className="plan-cat-actions">
                  <button className="edit-cat-btn" onClick={() => startRename(cat)} title="Rename">✎</button>
                  <button className="remove-btn"   onClick={() => removeCategory(cat)} title="Remove">✕</button>
                </div>
              </div>

              <div className="cat-amount-wrap">
                <span className="currency-symbol">{sym}</span>
                <input
                  type="number"
                  min="0"
                  step={50}
                  value={val === 0 ? '' : val}
                  placeholder="0"
                  onChange={(e) => setAmount(cat, e.target.value)}
                  className="amount-input"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="add-category">
        <input
          ref={newCatRef}
          type="text"
          placeholder="New category name…"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          className="new-cat-input"
        />
        <button className="btn btn--secondary" onClick={addCategory}>+ Add</button>
      </div>

      <div className="planning-footer">
        <div className="total-bar">
          <span>Total / month</span>
          <span className="total-amount">{sym}{total.toLocaleString()}</span>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={saving || isLocked}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="saved-msg">Saved!</span>}
      </div>
    </div>
  );
}
