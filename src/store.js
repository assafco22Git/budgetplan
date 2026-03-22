import {
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs, deleteDoc,
  collection, onSnapshot,
  arrayUnion, arrayRemove, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
  'Housing',
  'Food & Groceries',
  'Transportation',
  'Healthcare',
  'Entertainment',
  'Clothing',
  'Savings',
  'Other',
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'ILS', symbol: '₪',  label: 'ILS — Israeli Shekel' },
  { code: 'JPY', symbol: '¥',  label: 'JPY — Japanese Yen' },
];

// ── Device preferences (localStorage) ────────────────────────────────────────

export function getCurrency() { return localStorage.getItem('budget_currency') || 'USD'; }
export function saveCurrency(c) { localStorage.setItem('budget_currency', c); }
export function getTheme() { return localStorage.getItem('budget_theme') || 'dark'; }
export function saveTheme(t) { localStorage.setItem('budget_theme', t); }

// ── Path helper ───────────────────────────────────────────────────────────────
// Budgets live at users/{ownerUid}/budgets/{budgetId} — within the path
// already covered by existing Firestore rules.

function budgetRef(ownerUid, budgetId) {
  return doc(db, 'users', ownerUid, 'budgets', budgetId);
}
function budgetsCol(ownerUid) {
  return collection(db, 'users', ownerUid, 'budgets');
}

// ── Budget CRUD ───────────────────────────────────────────────────────────────

export async function createBudget(uid, email, displayName, name) {
  const ref = await addDoc(budgetsCol(uid), {
    name,
    ownerId: uid,
    memberIds: [uid],
    members: {
      [uid]: { email, displayName, role: 'owner', joinedAt: serverTimestamp() },
    },
    pendingInviteEmails: [],
    pendingInvites: [],
    editLock: null,
    budgetData: {},
    expenses: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function loadUserBudgets(uid, email, displayName) {
  const snap = await getDocs(budgetsCol(uid));
  let budgets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Migration: if no budgets, check the old single-budget location
  if (budgets.length === 0) {
    const [budgetSnap, expensesSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'data', 'budget')),
      getDoc(doc(db, 'users', uid, 'data', 'expenses')),
    ]);
    const oldBudgetData = budgetSnap.exists()   ? budgetSnap.data()                    : {};
    const oldExpenses   = expensesSnap.exists() ? (expensesSnap.data().entries ?? []) : [];
    const newId = await createBudget(uid, email, displayName, 'My Budget');
    if (Object.keys(oldBudgetData).length > 0 || oldExpenses.length > 0) {
      await updateDoc(budgetRef(uid, newId), { budgetData: oldBudgetData, expenses: oldExpenses });
    }
    const freshSnap = await getDocs(budgetsCol(uid));
    budgets = freshSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  return budgets;
}

export async function updateBudgetData(ownerUid, budgetId, budgetData) {
  await updateDoc(budgetRef(ownerUid, budgetId), { budgetData });
}

export async function updateBudgetExpenses(ownerUid, budgetId, expenses) {
  await updateDoc(budgetRef(ownerUid, budgetId), { expenses });
}

export async function renameBudget(ownerUid, budgetId, name) {
  await updateDoc(budgetRef(ownerUid, budgetId), { name });
}

export async function deleteBudget(ownerUid, budgetId) {
  await deleteDoc(budgetRef(ownerUid, budgetId));
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function inviteUserToBudget(ownerUid, budgetId, inviterName, inviteeEmail) {
  const ref = budgetRef(ownerUid, budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (Object.values(data.members || {}).some((m) => m.email === inviteeEmail)) throw new Error('already-member');
  if ((data.pendingInviteEmails || []).includes(inviteeEmail)) throw new Error('already-invited');
  await updateDoc(ref, {
    pendingInviteEmails: arrayUnion(inviteeEmail),
    pendingInvites: arrayUnion({ email: inviteeEmail, invitedByName: inviterName }),
  });
}

export async function cancelInvite(ownerUid, budgetId, email) {
  const ref = budgetRef(ownerUid, budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(ref, {
    pendingInviteEmails: arrayRemove(email),
    pendingInvites: (data.pendingInvites || []).filter((i) => i.email !== email),
  });
}

export async function removePartnerFromBudget(ownerUid, budgetId, targetUid) {
  await updateDoc(budgetRef(ownerUid, budgetId), {
    memberIds: arrayRemove(targetUid),
    [`members.${targetUid}`]: deleteField(),
  });
}

// ── Edit lock ─────────────────────────────────────────────────────────────────

export async function acquireEditLock(ownerUid, budgetId, lockingUid, displayName) {
  const ref = budgetRef(ownerUid, budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false };
  const lock = snap.data().editLock;
  const stale = !lock || (Date.now() - (lock.lockedAt?.toMillis?.() ?? 0)) > 300000;
  if (stale || lock?.uid === lockingUid) {
    await updateDoc(ref, { editLock: { uid: lockingUid, displayName, lockedAt: serverTimestamp() } });
    return { success: true };
  }
  return { success: false, lockedBy: lock.displayName };
}

export async function releaseEditLock(ownerUid, budgetId, lockingUid) {
  const ref = budgetRef(ownerUid, budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().editLock?.uid === lockingUid) {
    await updateDoc(ref, { editLock: null });
  }
}

// ── Real-time subscription ────────────────────────────────────────────────────

export function subscribeToBudget(ownerUid, budgetId, callback) {
  return onSnapshot(budgetRef(ownerUid, budgetId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

// ── Pure utility ──────────────────────────────────────────────────────────────

export function getTotalSpentByCategory(expenses) {
  const totals = {};
  for (const entry of expenses) {
    for (const [cat, amount] of Object.entries(entry.amounts)) {
      totals[cat] = (totals[cat] || 0) + Number(amount);
    }
  }
  return totals;
}
