import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import Planning from './pages/Planning';
import FollowUp from './pages/FollowUp';
import Dashboard from './pages/Dashboard';
import LoginScreen from './components/LoginScreen';
import {
  CURRENCIES, getCurrency, saveCurrency,
  getTheme, saveTheme,
  loadUserBudgets, createBudget, updateBudgetData, updateBudgetExpenses,
  renameBudget, deleteBudget, inviteUserToBudget, cancelInvite,
  removePartnerFromBudget, acquireEditLock, releaseEditLock, subscribeToBudget,
} from './store';
import './App.css';

const PAGES = ['Home', 'Plan', 'Follow-Up'];

export default function App() {
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError]     = useState('');

  const [budgets,        setBudgets]        = useState([]);
  const [activeBudgetId, setActiveBudgetId] = useState(null);

  const [page,         setPage]         = useState('Home');
  const [currencyCode, setCurrencyCode] = useState(getCurrency);
  const [theme,        setTheme]        = useState(getTheme);

  const [lockResult, setLockResult] = useState(null);

  // Sliding nav
  const navRef  = useRef(null);
  const btnRefs = useRef({});
  const [sliderStyle, setSliderStyle] = useState({});

  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];

  const activeBudget = budgets.find((b) => b.id === activeBudgetId) || null;
  const budget       = activeBudget?.budgetData || {};
  const expenses     = activeBudget?.expenses   || [];
  const editLock     = activeBudget?.editLock   || null;

  const isLockedByOther =
    editLock &&
    editLock.uid !== user?.uid &&
    (Date.now() - (editLock.lockedAt?.toMillis?.() ?? 0)) < 300000;

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
        try {
          const loaded = await loadUserBudgets(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName || firebaseUser.email,
          );
          setBudgets(loaded);
          setActiveBudgetId(loaded[0]?.id || null);
        } catch (err) {
          console.error('Failed to load budgets:', err);
        }
        setDataLoading(false);
      } else {
        setBudgets([]);
        setActiveBudgetId(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Subscribe to the active budget via onSnapshot
  useEffect(() => {
    if (!activeBudgetId) return;
    const unsub = subscribeToBudget(activeBudgetId, (updated) => {
      setBudgets((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
    });
    return unsub;
  }, [activeBudgetId]);

  // Edit lock acquisition / release
  useEffect(() => {
    if (!activeBudgetId || !user?.uid) return;
    if (page !== 'Plan' && page !== 'Follow-Up') return;

    let released = false;
    acquireEditLock(activeBudgetId, user.uid, user.displayName || user.email).then((result) => {
      if (!released) setLockResult(result);
    });

    return () => {
      released = true;
      releaseEditLock(activeBudgetId, user.uid);
      setLockResult(null);
    };
  }, [page, activeBudgetId, user?.uid]);

  // Sliding nav pill
  useLayoutEffect(() => {
    const btn = btnRefs.current[page];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSliderStyle({
      left:   btnRect.left - navRect.left,
      width:  btnRect.width,
      height: btnRect.height,
      top:    btnRect.top  - navRect.top,
    });
  }, [page]);

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

  async function handleSaveBudget(newBudgetData) {
    if (!activeBudgetId) return;
    setBudgets((prev) =>
      prev.map((b) => b.id === activeBudgetId ? { ...b, budgetData: newBudgetData } : b)
    );
    await updateBudgetData(activeBudgetId, newBudgetData);
  }

  async function handleSaveExpenses(newExpenses) {
    if (!activeBudgetId) return;
    setBudgets((prev) =>
      prev.map((b) => b.id === activeBudgetId ? { ...b, expenses: newExpenses } : b)
    );
    await updateBudgetExpenses(activeBudgetId, newExpenses);
  }

  async function handleCreateBudget(name) {
    if (!user) return;
    const id = await createBudget(
      user.uid,
      user.email,
      user.displayName || user.email,
      name,
    );
    const placeholder = {
      id,
      name,
      ownerId: user.uid,
      memberIds: [user.uid],
      members: { [user.uid]: { email: user.email, displayName: user.displayName || user.email, role: 'owner' } },
      pendingInviteEmails: [],
      pendingInvites: [],
      editLock: null,
      budgetData: {},
      expenses: [],
    };
    setBudgets((prev) => [...prev, placeholder]);
    setActiveBudgetId(id);
  }

  function handleSelectBudget(id) {
    setActiveBudgetId(id);
  }

  async function handleInvitePartner(email) {
    if (!activeBudgetId || !user) return;
    await inviteUserToBudget(
      activeBudgetId,
      user.uid,
      user.displayName || user.email,
      email,
    );
  }

  async function handleCancelInvite(email) {
    if (!activeBudgetId) return;
    await cancelInvite(activeBudgetId, email);
  }

  async function handleRemovePartner(targetUid) {
    if (!activeBudgetId) return;
    await removePartnerFromBudget(activeBudgetId, targetUid);
  }

  async function handleRenameBudget(name) {
    if (!activeBudgetId) return;
    setBudgets((prev) =>
      prev.map((b) => b.id === activeBudgetId ? { ...b, name } : b)
    );
    await renameBudget(activeBudgetId, name);
  }

  async function handleDeleteBudget() {
    if (!activeBudgetId || !user) return;
    const remaining = budgets.filter((b) => b.id !== activeBudgetId);
    await deleteBudget(activeBudgetId, user.uid);
    setBudgets(remaining);
    setActiveBudgetId(remaining[0]?.id || null);
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
        <nav className="app-nav" ref={navRef}>
          <div className="nav-slider" style={sliderStyle} />
          {PAGES.map((p) => (
            <button
              key={p}
              ref={(el) => { btnRefs.current[p] = el; }}
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
        {page === 'Home' && (
          <Dashboard
            budget={budget}
            expenses={expenses}
            currency={currency}
            budgets={budgets}
            activeBudgetId={activeBudgetId}
            activeBudget={activeBudget}
            user={user}
            onSelectBudget={handleSelectBudget}
            onCreateBudget={handleCreateBudget}
            onInvitePartner={handleInvitePartner}
            onCancelInvite={handleCancelInvite}
            onRemovePartner={handleRemovePartner}
            onRenameBudget={handleRenameBudget}
            onDeleteBudget={handleDeleteBudget}
            isLocked={isLockedByOther}
            lockedBy={editLock?.displayName}
          />
        )}
        {page === 'Plan' && (
          <Planning
            key={activeBudgetId}
            budget={budget}
            onSaveBudget={handleSaveBudget}
            currency={currency}
            isLocked={isLockedByOther}
            lockedBy={editLock?.displayName}
          />
        )}
        {page === 'Follow-Up' && (
          <FollowUp
            key={activeBudgetId}
            budget={budget}
            expenses={expenses}
            onSaveExpenses={handleSaveExpenses}
            currency={currency}
            isLocked={isLockedByOther}
            lockedBy={editLock?.displayName}
          />
        )}
      </main>
    </div>
  );
}
