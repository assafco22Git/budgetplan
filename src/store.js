import {
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs, deleteDoc,
  collection, query, where, onSnapshot,
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

// ── Device preferences (localStorage — per device) ───────────────────────────

const CURRENCY_KEY = 'budget_currency';
const THEME_KEY    = 'budget_theme';

export function getCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || 'USD';
}
export function saveCurrency(code) {
  localStorage.setItem(CURRENCY_KEY, code);
}

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}
export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// ── Firestore — budgets ───────────────────────────────────────────────────────

export async function createBudget(uid, email, displayName, name) {
  const ref = await addDoc(collection(db, 'budgets'), {
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
  // 1. Query budgets where user is already a member
  const memberQ = query(collection(db, 'budgets'), where('memberIds', 'array-contains', uid));
  const memberSnap = await getDocs(memberQ);
  const budgets = memberSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 2. Check for pending invites by email and auto-accept them
  const inviteQ = query(collection(db, 'budgets'), where('pendingInviteEmails', 'array-contains', email));
  const inviteSnap = await getDocs(inviteQ);
  const acceptPromises = [];
  for (const d of inviteSnap.docs) {
    if (budgets.some((b) => b.id === d.id)) continue;
    const data = d.data();
    const inviteEntry = (data.pendingInvites || []).find((i) => i.email === email);
    acceptPromises.push(
      updateDoc(doc(db, 'budgets', d.id), {
        memberIds: arrayUnion(uid),
        [`members.${uid}`]: { email, displayName, role: 'member', joinedAt: serverTimestamp() },
        pendingInviteEmails: arrayRemove(email),
        pendingInvites: (data.pendingInvites || []).filter((i) => i.email !== email),
      })
    );
    budgets.push({ id: d.id, ...data });
  }
  await Promise.all(acceptPromises);

  // 3. Migrate old data if no budgets found
  if (budgets.length === 0) {
    const [budgetSnap, expensesSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'data', 'budget')),
      getDoc(doc(db, 'users', uid, 'data', 'expenses')),
    ]);
    const oldBudgetData = budgetSnap.exists() ? budgetSnap.data() : {};
    const oldExpenses   = expensesSnap.exists() ? (expensesSnap.data().entries ?? []) : [];
    const newId = await createBudget(uid, email, displayName, 'My Budget');
    await updateDoc(doc(db, 'budgets', newId), {
      budgetData: oldBudgetData,
      expenses: oldExpenses,
    });
    budgets.push({
      id: newId,
      name: 'My Budget',
      ownerId: uid,
      memberIds: [uid],
      members: { [uid]: { email, displayName, role: 'owner' } },
      pendingInviteEmails: [],
      pendingInvites: [],
      editLock: null,
      budgetData: oldBudgetData,
      expenses: oldExpenses,
    });
  }

  return budgets;
}

export async function updateBudgetData(budgetId, budgetData) {
  await updateDoc(doc(db, 'budgets', budgetId), { budgetData });
}

export async function updateBudgetExpenses(budgetId, expenses) {
  await updateDoc(doc(db, 'budgets', budgetId), { expenses });
}

export async function renameBudget(budgetId, name) {
  await updateDoc(doc(db, 'budgets', budgetId), { name });
}

export async function deleteBudget(budgetId, uid) {
  const ref = doc(db, 'budgets', budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.ownerId === uid) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, {
      memberIds: arrayRemove(uid),
      [`members.${uid}`]: deleteField(),
    });
  }
}

export async function inviteUserToBudget(budgetId, inviterUid, inviterName, inviteeEmail) {
  const ref = doc(db, 'budgets', budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const members = data.members || {};
  const isAlreadyMember = Object.values(members).some((m) => m.email === inviteeEmail);
  if (isAlreadyMember) throw new Error('already-member');
  const isPending = (data.pendingInviteEmails || []).includes(inviteeEmail);
  if (isPending) throw new Error('already-invited');
  await updateDoc(ref, {
    pendingInviteEmails: arrayUnion(inviteeEmail),
    pendingInvites: arrayUnion({ email: inviteeEmail, invitedBy: inviterUid, invitedByName: inviterName }),
  });
}

export async function cancelInvite(budgetId, email) {
  const ref = doc(db, 'budgets', budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const entry = (data.pendingInvites || []).find((i) => i.email === email);
  await updateDoc(ref, {
    pendingInviteEmails: arrayRemove(email),
    pendingInvites: (data.pendingInvites || []).filter((i) => i.email !== email),
  });
}

export async function removePartnerFromBudget(budgetId, targetUid) {
  await updateDoc(doc(db, 'budgets', budgetId), {
    memberIds: arrayRemove(targetUid),
    [`members.${targetUid}`]: deleteField(),
  });
}

export async function acquireEditLock(budgetId, uid, displayName) {
  const ref = doc(db, 'budgets', budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, lockedBy: null };
  const lock = snap.data().editLock;
  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;
  const isStale = !lock || (now - (lock.lockedAt?.toMillis?.() ?? 0)) > FIVE_MIN;
  const isSameUser = lock && lock.uid === uid;
  if (isStale || isSameUser) {
    await updateDoc(ref, {
      editLock: { uid, displayName, lockedAt: serverTimestamp() },
    });
    return { success: true };
  }
  return { success: false, lockedBy: lock.displayName };
}

export async function releaseEditLock(budgetId, uid) {
  const ref = doc(db, 'budgets', budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const lock = snap.data().editLock;
  if (lock && lock.uid === uid) {
    await updateDoc(ref, { editLock: null });
  }
}

export function subscribeToBudget(budgetId, callback) {
  return onSnapshot(doc(db, 'budgets', budgetId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    }
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
