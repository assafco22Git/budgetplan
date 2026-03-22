import { doc, getDoc, setDoc } from 'firebase/firestore';
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

// ── Firestore — user data ─────────────────────────────────────────────────────

export async function loadUserData(uid) {
  const [budgetSnap, expensesSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'data', 'budget')),
    getDoc(doc(db, 'users', uid, 'data', 'expenses')),
  ]);
  return {
    budget:   budgetSnap.exists()   ? budgetSnap.data()              : {},
    expenses: expensesSnap.exists() ? (expensesSnap.data().entries ?? []) : [],
  };
}

export async function saveUserBudget(uid, budget) {
  await setDoc(doc(db, 'users', uid, 'data', 'budget'), budget);
}

export async function saveUserExpenses(uid, expenses) {
  await setDoc(doc(db, 'users', uid, 'data', 'expenses'), { entries: expenses });
}

// ── Pure utility ──────────────────────────────────────────────────────────────

// Returns { category: totalSpent }
export function getTotalSpentByCategory(expenses) {
  const totals = {};
  for (const entry of expenses) {
    for (const [cat, amount] of Object.entries(entry.amounts)) {
      totals[cat] = (totals[cat] || 0) + Number(amount);
    }
  }
  return totals;
}
