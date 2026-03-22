// localStorage-backed store for budget data

const BUDGET_KEY = 'budget_plan';
const EXPENSES_KEY = 'budget_expenses';
const CURRENCY_KEY = 'budget_currency';

export const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'ILS', symbol: '₪',  label: 'ILS — Israeli Shekel' },
  { code: 'JPY', symbol: '¥',  label: 'JPY — Japanese Yen' },
];

export function getCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || 'USD';
}

export function saveCurrency(code) {
  localStorage.setItem(CURRENCY_KEY, code);
}

const THEME_KEY = 'budget_theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

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

export function getBudget() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBudget(budget) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
}

export function getExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

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
