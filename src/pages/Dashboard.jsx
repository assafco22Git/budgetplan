import { useState } from 'react';
import { DEFAULT_CATEGORIES, getTotalSpentByCategory } from '../store';

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
  if (pct >= 1)   return 'over';
  if (pct >= 0.8) return 'warning';
  return 'good';
}

export default function Dashboard({
  budget, expenses, currency,
  budgets, activeBudgetId, activeBudget, user,
  onSelectBudget, onCreateBudget, onInvitePartner, onCancelInvite,
  onRemovePartner, onRenameBudget, onDeleteBudget,
  isLocked, lockedBy,
}) {
  const [showNewModal,    setShowNewModal]    = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newBudgetName,   setNewBudgetName]   = useState('');
  const [createError,     setCreateError]     = useState('');
  const [creating,        setCreating]        = useState(false);
  const [inviteEmail,     setInviteEmail]     = useState('');
  const [inviteError,     setInviteError]     = useState('');
  const [inviteLoading,   setInviteLoading]   = useState(false);

  const removed    = budget._removedCategories || [];
  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES.filter((c) => !removed.includes(c)),
    ...Object.keys(budget).filter(
      (k) => !['_month', '_removedCategories'].includes(k) && !DEFAULT_CATEGORIES.includes(k)
    ),
  ]));

  const spentByCategory = getTotalSpentByCategory(expenses);

  const rows = categories
    .map((cat) => {
      const target    = Number(budget[cat]) || 0;
      const spent     = spentByCategory[cat] || 0;
      const remaining = target - spent;
      const pct       = target > 0 ? (spent / target) * 100 : 0;
      const status    = getStatus(spent, target);
      return { cat, target, spent, remaining, pct, status };
    })
    .filter((r) => r.target > 0 || r.spent > 0);

  const totalBudget    = rows.reduce((s, r) => s + r.target, 0);
  const totalSpent     = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct     = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overallStatus  = getStatus(totalSpent, totalBudget);

  const month = budget._month
    ? new Date(budget._month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const sym = currency.symbol;
  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const members        = activeBudget?.members        || {};
  const pendingInvites = activeBudget?.pendingInvites || [];
  const isOwner        = activeBudget?.ownerId === user?.uid;

  async function handleCreateBudget() {
    const name = newBudgetName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError('');
    try {
      await onCreateBudget(name);
      setNewBudgetName('');
      setShowNewModal(false);
    } catch (err) {
      console.error('Create budget failed:', err);
      setCreateError('Failed to create budget. Check your connection and try again.');
    }
    setCreating(false);
  }

  async function handleSendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      await onInvitePartner(email);
      const budgetName = activeBudget?.name || 'our budget';
      window.open(
        `mailto:${email}?subject=You've been invited to ${budgetName} on BudgetPlan&body=Hi! You've been invited to join "${budgetName}" on BudgetPlan. Sign in at the app to accept.`,
        '_blank',
      );
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (err) {
      if (err.message === 'already-member') {
        setInviteError('This person is already a member of this budget.');
      } else if (err.message === 'already-invited') {
        setInviteError('An invite has already been sent to this email.');
      } else {
        setInviteError('Failed to send invite. Please try again.');
      }
    }
    setInviteLoading(false);
  }

  return (
    <div className="page dashboard">
      {/* Budget management bar */}
      <div className="budget-bar card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Budget:
          </label>
          {budgets.length > 0 ? (
            <select
              className="budget-name-select"
              value={activeBudgetId || ''}
              onChange={(e) => onSelectBudget(e.target.value)}
            >
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>(no budget)</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => { setNewBudgetName(''); setShowNewModal(true); }}>
            + New Budget
          </button>
          {isOwner && (
            <button className="btn btn--ghost btn--sm" onClick={() => { setInviteEmail(''); setInviteError(''); setShowInviteModal(true); }}>
              + Add Partner
            </button>
          )}
          {isOwner && budgets.length > 0 && (
            <button
              className="btn btn--danger btn--sm"
              onClick={() => {
                if (window.confirm(`Delete "${activeBudget?.name}"? This cannot be undone.`)) {
                  onDeleteBudget();
                }
              }}
            >
              Delete
            </button>
          )}
        </div>

        {/* Members & pending invites */}
        {(Object.keys(members).length > 0 || pendingInvites.length > 0) && (
          <div className="partners-section">
            {Object.entries(members).map(([uid, m]) => (
              <div key={uid} className="partner-chip">
                <span className="partner-avatar">{(m.displayName || m.email || '?')[0].toUpperCase()}</span>
                <span className="partner-info">
                  <span className="partner-name">{m.displayName || m.email}</span>
                  {m.displayName && <span className="partner-email">{m.email}</span>}
                </span>
                <span className="partner-role">{m.role}</span>
                {isOwner && m.role !== 'owner' && (
                  <button
                    className="partner-remove-btn"
                    title="Remove member"
                    onClick={() => {
                      if (window.confirm(`Remove ${m.displayName || m.email} from this budget?`)) {
                        onRemovePartner(uid);
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {pendingInvites.map((inv) => (
              <div key={inv.email} className="pending-chip">
                <span className="partner-info">
                  <span className="partner-name">{inv.email}</span>
                  <span className="partner-email">Invite pending</span>
                </span>
                {isOwner && (
                  <button
                    className="partner-remove-btn"
                    title="Cancel invite"
                    onClick={() => onCancelInvite(inv.email)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isLocked && (
          <div className="lock-banner" style={{ width: '100%' }}>
            🔒 {lockedBy} is currently editing — changes made here are read-only.
          </div>
        )}
      </div>

      <div className="page-header">
        <h2>Home</h2>
        {month && <p className="page-subtitle">{month}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📊</div>
          <p>No budget plan found. Go to <strong>Plan</strong> to set your monthly targets.</p>
        </div>
      ) : (
        <>
          <div className="summary-cards">
            <div className="summary-card card">
              <span className="summary-label">Total Budget</span>
              <span className="summary-value">{sym}{totalBudget.toLocaleString()}</span>
            </div>
            <div className="summary-card card">
              <span className="summary-label">Total Spent</span>
              <span className={`summary-value summary-value--${overallStatus}`}>{sym}{fmt(totalSpent)}</span>
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
                      {remaining >= 0 ? `${sym}${fmt(remaining)} left` : `${sym}${fmt(Math.abs(remaining))} over`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* New budget modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => !creating && setShowNewModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Create New Budget</div>
            <input
              className="modal-input"
              type="text"
              placeholder="Budget name…"
              value={newBudgetName}
              autoFocus
              onChange={(e) => { setNewBudgetName(e.target.value); setCreateError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleCreateBudget();
                if (e.key === 'Escape') setShowNewModal(false);
              }}
            />
            {createError && (
              <p style={{ fontSize: 14, color: 'var(--danger)' }}>{createError}</p>
            )}
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setShowNewModal(false)} disabled={creating}>Cancel</button>
              <button className="btn btn--primary" onClick={handleCreateBudget} disabled={!newBudgetName.trim() || creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Invite Partner</div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Enter their email address. They'll be added when they sign in.
            </p>
            <input
              className="modal-input"
              type="email"
              placeholder="partner@email.com"
              value={inviteEmail}
              autoFocus
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleSendInvite();
                if (e.key === 'Escape') setShowInviteModal(false);
              }}
            />
            {inviteError && (
              <p style={{ fontSize: 14, color: 'var(--danger)' }}>{inviteError}</p>
            )}
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || inviteLoading}
              >
                {inviteLoading ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
