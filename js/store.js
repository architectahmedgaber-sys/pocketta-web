// All data lives in one object, saved to IndexedDB on this phone. Ported from the Android Repo.
import * as C from './core.js';

const DB_NAME = 'pocketta', STORE = 'kv', KEY = 'data';

export const EXPENSE_SEED = [
  ['Food', ['Groceries', 'Eating out', 'Delivery', 'Coffee']],
  ['Transport', ['Uber / Careem', 'Microbus / Metro', 'Fuel', 'Parking', 'Car service']],
  ['Home', ['Rent', 'Maintenance', 'Cleaning', 'Furniture']],
  ['Bills', ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile']],
  ['Subscriptions', []],
  ['Health', ['Doctor', 'Pharmacy', 'Lab tests']],
  ['Shopping', ['Clothes', 'Electronics', 'Home stuff']],
  ['Family', []], ['Education', []],
  ['Fun', ['Outings', 'Trips', 'Games']],
  ['Personal care', []], ['Gifts & charity', []], ['Installments', []], ["Gam'eya", []], ['Loans', []], ['Other', []],
];
export const INCOME_SEED = ['Salary', "Gam'eya payout", 'Borrowed', 'Loan repaid', 'Side work', 'Gift', 'Other income'];

const DEFAULT_SETTINGS = {
  onboarded: false, cycleStart: 1, baseCurrency: 'EGP', salary: 0, salaryDay: 1, salaryWallet: 0,
  savingsPerMonth: 0, budgetAlert: true, rates: {}, lastCategory: 0, lastWallet: 0, pinHash: '', pinSalt: '', overAlert: '',
  // 1.3: look, savings goal, today's rates from the internet (your own rates still win)
  theme: 'AUTO', goalName: '', goalAmount: 0, goalSaved: 0,
  autoRates: true, autoCurrencies: ['USD', 'EUR', 'SAR'], onlineRates: {}, prevOnlineRates: {}, gold: {}, prevGold: {}, ratesUpdated: '', ratesFetchedAt: 0,
};

function empty() {
  return { app: 'pocketta', v: 1, seq: 1, settings: { ...DEFAULT_SETTINGS }, wallets: [], categories: [], txns: [], bills: [], installments: [], circles: [], loans: [] };
}

export let data = empty();
const listeners = new Set();
export const onChange = (f) => listeners.add(f);

// ---------- Persistence ----------

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
let dbp = null;
async function idb(mode, fn) {
  dbp = dbp || openDb();
  const db = await dbp;
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
}

export async function load() {
  let raw = null;
  try { raw = await idb('readonly', (s) => s.get(KEY)); } catch (e) { console.warn(e); }
  if (!raw) { try { raw = JSON.parse(localStorage.getItem('pocketta-data') || 'null'); } catch { raw = null; } }
  data = normalize(raw) || empty();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* fine */ }
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const copy = JSON.parse(JSON.stringify(data));
    try { await idb('readwrite', (s) => s.put(copy, KEY)); }
    catch (e) { try { localStorage.setItem('pocketta-data', JSON.stringify(copy)); } catch { console.error(e); } }
  }, 50);
}

export function changed() { persist(); listeners.forEach((f) => f()); }

function normalize(raw) {
  if (!raw || raw.app !== 'pocketta' || !Array.isArray(raw.txns)) return null;
  const d = empty();
  for (const k of Object.keys(d)) if (raw[k] !== undefined) d[k] = raw[k];
  d.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  return d;
}

// Ids are unique across devices (time + random), so a later Google-account sync can merge records safely.
let lastId = 0;
export const nextId = () => (lastId = Math.max(lastId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)));
export const S = () => data.settings;
export function setSetting(k, v) { data.settings[k] = v; changed(); }
export const rateOf = (cur) => cur === S().baseCurrency ? 1 : (S().rates[cur] || (S().autoRates ? S().onlineRates[cur] : 0) || 1);
export const currencies = () => [...new Set([S().baseCurrency, ...Object.keys(S().rates).sort(),
  ...(S().autoRates ? S().autoCurrencies.filter((c) => S().onlineRates[c]) : [])])];
export const isManual = (cur) => !!S().rates[cur];
/** Change since yesterday as a fraction (0.01 = up 1%), or null when yesterday is not known. */
export function rateChange(cur) { const n = S().onlineRates[cur], b = S().prevOnlineRates[cur]; return n && b ? (n - b) / b : null; }
export function goldChange(k) { const n = S().gold[k], b = S().prevGold[k]; return n && b ? (n - b) / b : null; }

// ---------- Today's rates and gold (a small file the project publishes every day) ----------

const RATES_URL = 'https://raw.githubusercontent.com/architectahmedgaber-sys/pocketta/rates/rates.json';
const readMap = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) if (v > 0) out[k.toUpperCase()] = +v; return out; };
export async function refreshRates(force = false) {
  const s = S();
  if (!s.autoRates) return false;
  if (!force && Date.now() - s.ratesFetchedAt < 6 * 3600000) return true;
  try {
    const res = await fetch(RATES_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    const rates = readMap(j.rates), gold = readMap(j.gold);
    if (!Object.keys(rates).length) throw new Error('empty');
    if (j.previous) { s.prevOnlineRates = readMap(j.previous.rates); s.prevGold = readMap(j.previous.gold); }
    else if (Object.keys(s.onlineRates).length && String(s.ratesUpdated).slice(0, 10) !== String(j.updated).slice(0, 10)) { s.prevOnlineRates = s.onlineRates; s.prevGold = s.gold; }
    s.onlineRates = rates; s.gold = gold; s.ratesUpdated = String(j.updated || ''); s.ratesFetchedAt = Date.now();
    changed();
    return true;
  } catch (e) { return false; }
}
export const base = (t) => t.amount * (t.rate || 1);

// ---------- Backup ----------

export function exportJson() { return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }); }
export function importJson(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return false; }
  const d = normalize(raw);
  if (!d) return false;
  data = d;
  changed();
  return true;
}
export function wipe() { data = empty(); changed(); }

// ---------- Seed ----------

export function ensureSeeded() {
  if (data.wallets.length) return;
  for (const [i, [name, type]] of [['Cash', 'CASH'], ['Bank account', 'BANK'], ['Vodafone Cash', 'MOBILE']].entries()) {
    data.wallets.push({ id: nextId(), name, type, currency: 'EGP', opening: 0, sort: i, archived: false });
  }
  let sort = 0;
  for (const [name, subs] of EXPENSE_SEED) {
    const pid = nextId();
    data.categories.push({ id: pid, name, parentId: null, kind: 'EXPENSE', monthlyLimit: 0, sort: sort++, archived: false });
    subs.forEach((s, i) => data.categories.push({ id: nextId(), name: s, parentId: pid, kind: 'EXPENSE', monthlyLimit: 0, sort: i, archived: false }));
  }
  for (const name of INCOME_SEED) data.categories.push({ id: nextId(), name, parentId: null, kind: 'INCOME', monthlyLimit: 0, sort: sort++, archived: false });
  changed();
}

export const wallets = () => data.wallets.filter((w) => !w.archived).sort((a, b) => a.sort - b.sort);
export const categories = () => data.categories.filter((c) => !c.archived);
export const byId = (list, id) => list.find((x) => x.id === id);

export function categoryNamed(name, kind) {
  const n = name.toLowerCase();
  return (data.categories.find((c) => c.name.toLowerCase() === n && c.kind === kind && !c.archived) ||
    data.categories.find((c) => c.name.toLowerCase() === n && c.kind === kind))?.id ?? null;
}
function defaultWallet() {
  const ws = wallets();
  return (ws.find((w) => w.id === S().lastWallet) || ws[0])?.id ?? 0;
}

export function categoryLabel(id) {
  const c = byId(data.categories, id);
  if (!c) return 'No category';
  const p = c.parentId ? byId(data.categories, c.parentId) : null;
  return p ? `${p.name} · ${c.name}` : c.name;
}

// ---------- Transactions ----------

function txn(t) {
  return {
    id: nextId(), type: 'EXPENSE', amount: 0, currency: S().baseCurrency, rate: 1, walletId: 0, toWalletId: null,
    categoryId: null, note: '', epochDay: C.todayEpoch(), createdAt: Date.now(), source: '', sourceId: 0, spread: false, ...t,
  };
}

export function saveTxn(t) {
  if (!t.id) data.txns.push(txn(t));
  else { const i = data.txns.findIndex((x) => x.id === t.id); if (i >= 0) data.txns[i] = { ...data.txns[i], ...t }; }
  if (t.type === 'EXPENSE' && t.categoryId && !t.source) S().lastCategory = t.categoryId;
  S().lastWallet = t.walletId;
  changed();
}

export function deleteTxn(t) {
  data.txns = data.txns.filter((x) => x.id !== t.id);
  if (t.source === 'INSTALLMENT') { const i = byId(data.installments, t.sourceId); if (i) i.paid = Math.max(i.paid - 1, 0); }
  if (t.source === 'CIRCLE') {
    const c = byId(data.circles, t.sourceId);
    if (c) { if (t.type === 'INCOME') c.payoutReceived = false; else c.paid = Math.max(c.paid - 1, 0); }
  }
  if (t.source === 'LOAN') {
    const l = byId(data.loans, t.sourceId);
    if (l) {
      const lent = l.direction === 'LENT';
      if ((lent && t.type === 'INCOME') || (!lent && t.type === 'EXPENSE')) {
        l.repaid = Math.max(l.repaid - t.amount, 0);
        l.closed = l.repaid >= l.amount - 0.001;
      }
    }
  }
  changed();
}

/** Guesses the category for a quick note like "koshary": same note as before, or a category with that name. */
export function guessCategory(note, type) {
  if (!note.trim()) return null;
  const n = note.trim().toLowerCase();
  const prev = [...data.txns].reverse().find((t) => t.type === type && t.note.toLowerCase() === n && t.categoryId);
  if (prev) return prev.categoryId;
  const words = n.split(' ').filter((w) => w.length >= 3);
  return categories().filter((c) => c.kind === type).find((c) => {
    const cn = c.name.toLowerCase();
    return words.some((w) => cn === w || cn.startsWith(w) || w.startsWith(cn));
  })?.id ?? null;
}

/** Saves an expense typed as a sentence ("koshary 60"): category from the words, else the last one used. */
export function quickExpense(note, amount, daysAgo = 0) {
  const cat = guessCategory(note, 'EXPENSE') || S().lastCategory || null;
  const t = txn({ type: 'EXPENSE', amount, walletId: defaultWallet(), categoryId: cat, note: note.trim(), epochDay: C.todayEpoch() - daysAgo });
  data.txns.push(t);
  changed();
  return t;
}

/** Expenses you type again and again, so they can be added with one tap. */
export function suggestions(today = C.todayEpoch()) {
  const groups = new Map();
  for (const t of data.txns) {
    if (t.type !== 'EXPENSE' || t.source || !t.note.trim() || t.currency !== S().baseCurrency || t.epochDay < today - 60 || t.epochDay > today) continue;
    const k = `${t.note.trim().toLowerCase()}|${t.amount}`;
    const g = groups.get(k) || { note: t.note.trim(), amount: t.amount, n: 0 };
    g.n++; groups.set(k, g);
  }
  return [...groups.values()].filter((g) => g.n >= 2).sort((a, b) => b.n - a.n).slice(0, 4);
}

/** The last 7 days against the 7 before, for the Friday/Saturday card. */
export function week(today, dayReference) {
  const from = today - 6;
  const ex = (a, b) => data.txns.filter((t) => t.type === 'EXPENSE' && !t.spread && t.epochDay >= a && t.epochDay < b);
  const now = ex(from, today + 1), before = ex(from - 7, from);
  const top = {};
  for (const t of now) { const c = byId(data.categories, t.categoryId); if (!c) continue; const p = c.parentId ? byId(data.categories, c.parentId) : c; top[p.name] = (top[p.name] || 0) + base(t); }
  const perDay = {};
  for (const t of now) perDay[t.epochDay] = (perDay[t.epochDay] || 0) + base(t);
  let under = 0;
  if (dayReference > 0) for (let d = from; d <= today; d++) if ((perDay[d] || 0) <= dayReference) under++;
  const best = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
  return { spent: now.reduce((a, t) => a + base(t), 0), previous: before.reduce((a, t) => a + base(t), 0), topCategory: best ? best[0] : null, daysUnder: under };
}

// ---------- Bills ----------

export function saveBill(b) {
  if (!b.id) data.bills.push({ ...b, id: nextId() });
  else { const i = data.bills.findIndex((x) => x.id === b.id); data.bills[i] = b; }
  changed();
}
export function deleteBill(b) { data.bills = data.bills.filter((x) => x.id !== b.id); changed(); }
export function estimate(b) {
  if (!b.variable) return b.amount;
  const last = data.txns.filter((t) => t.source === 'BILL' && t.sourceId === b.id).sort((a, c) => c.epochDay - a.epochDay).slice(0, 3);
  return last.length ? last.reduce((s, t) => s + t.amount, 0) / last.length : b.amount;
}
export function payBill(b, amount = null, day = C.todayEpoch()) {
  data.txns.push(txn({
    type: 'EXPENSE', amount: amount ?? estimate(b), currency: b.currency, rate: rateOf(b.currency),
    walletId: b.walletId || defaultWallet(),
    categoryId: b.categoryId || categoryNamed(b.kind === 'SUB' ? 'Subscriptions' : 'Bills', 'EXPENSE'),
    note: b.name, epochDay: day, source: 'BILL', sourceId: b.id, spread: C.isSpread(b.frequency, b.everyN),
  }));
  skipBill(b);
}
export function skipBill(b) {
  const x = byId(data.bills, b.id);
  if (x) x.nextDue = C.nextDue(x.nextDue, x.frequency, x.everyN, x.anchorDay);
  changed();
}

// ---------- Installments ----------

export function saveInstallment(it) {
  if (!it.id) data.installments.push({ ...it, id: nextId() });
  else { const i = data.installments.findIndex((x) => x.id === it.id); data.installments[i] = it; }
  changed();
}
export function deleteInstallment(it) { data.installments = data.installments.filter((x) => x.id !== it.id); changed(); }
export function payInstallment(it, day = C.todayEpoch()) {
  const x = byId(data.installments, it.id);
  if (!x || x.paid >= x.total) return;
  data.txns.push(txn({
    type: 'EXPENSE', amount: x.amount, walletId: x.walletId || defaultWallet(), categoryId: categoryNamed('Installments', 'EXPENSE'),
    note: x.name, epochDay: day, source: 'INSTALLMENT', sourceId: x.id,
  }));
  x.paid++;
  changed();
}

// ---------- Circles ----------

export function saveCircle(c) {
  if (!c.id) data.circles.push({ ...c, id: nextId() });
  else { const i = data.circles.findIndex((x) => x.id === c.id); data.circles[i] = c; }
  changed();
}
export function deleteCircle(c) { data.circles = data.circles.filter((x) => x.id !== c.id); changed(); }
export function payCircle(c, day = C.todayEpoch()) {
  const x = byId(data.circles, c.id);
  if (!x || x.paid >= x.months) return;
  data.txns.push(txn({
    type: 'EXPENSE', amount: x.share, walletId: x.walletId || defaultWallet(), categoryId: categoryNamed("Gam'eya", 'EXPENSE'),
    note: `${x.name} share`, epochDay: day, source: 'CIRCLE', sourceId: x.id,
  }));
  x.paid++;
  changed();
}
export function receivePayout(c, day = C.todayEpoch()) {
  const x = byId(data.circles, c.id);
  if (!x || x.payoutReceived) return;
  data.txns.push(txn({
    type: 'INCOME', amount: x.share * x.months, walletId: x.walletId || defaultWallet(), categoryId: categoryNamed("Gam'eya payout", 'INCOME'),
    note: `${x.name} payout`, epochDay: day, source: 'CIRCLE', sourceId: x.id,
  }));
  x.payoutReceived = true;
  changed();
}

// ---------- Loans ----------

export function addLoan({ person, lent, amount, walletId, day, due, note, record = true }) {
  const id = nextId();
  data.loans.push({ id, person, direction: lent ? 'LENT' : 'BORROWED', amount, repaid: 0, epochDay: day, dueDay: due ?? null, note: note || '', closed: false });
  if (record) {
    data.txns.push(txn({
      type: lent ? 'EXPENSE' : 'INCOME', amount, walletId: walletId || defaultWallet(),
      categoryId: lent ? categoryNamed('Loans', 'EXPENSE') : categoryNamed('Borrowed', 'INCOME'),
      note: lent ? `Lent to ${person}` : `Borrowed from ${person}`, epochDay: day, source: 'LOAN', sourceId: id,
    }));
  }
  changed();
}
export const remaining = (l) => Math.max(l.amount - l.repaid, 0);
export function loanPayment(l, amount, walletId = null, day = C.todayEpoch()) {
  const x = byId(data.loans, l.id);
  if (!x) return;
  const lent = x.direction === 'LENT';
  data.txns.push(txn({
    type: lent ? 'INCOME' : 'EXPENSE', amount, walletId: walletId || defaultWallet(),
    categoryId: lent ? categoryNamed('Loan repaid', 'INCOME') : categoryNamed('Loans', 'EXPENSE'),
    note: lent ? `${x.person} paid back` : `Paid back ${x.person}`, epochDay: day, source: 'LOAN', sourceId: x.id,
  }));
  x.repaid += amount;
  x.closed = x.repaid >= x.amount - 0.001;
  changed();
}
export function deleteLoan(l) { data.loans = data.loans.filter((x) => x.id !== l.id); changed(); }

// ---------- Salary ----------

export function salaryDateIn(cycle, day) {
  const { y, m } = C.ymd(cycle.start);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return [C.startIn(y, m, day), C.startIn(next[0], next[1], day)].find((d) => cycle.contains(d)) ?? null;
}
/** Records this month's salary on its day, once per cycle. */
export function ensureSalary(today = C.todayEpoch()) {
  const s = S();
  if (!(s.salary > 0)) return;
  const cycle = C.cycleFor(today, s.cycleStart);
  const d = salaryDateIn(cycle, s.salaryDay);
  if (d == null || today < d) return;
  if (data.txns.some((t) => t.source === 'SALARY' && cycle.contains(t.epochDay))) return;
  const w = wallets().find((x) => x.id === s.salaryWallet)?.id || defaultWallet();
  data.txns.push(txn({ type: 'INCOME', amount: s.salary, walletId: w, categoryId: categoryNamed('Salary', 'INCOME'), note: 'Salary', epochDay: d, source: 'SALARY' }));
  changed();
}

// ---------- Totals ----------

/** Everything unpaid that falls due before [to], including anything overdue. */
export function upcoming(to) {
  const out = [];
  for (const b of data.bills) {
    const est = estimate(b) * rateOf(b.currency);
    for (const d of C.occurrences(b.nextDue, b.frequency, b.everyN, b.nextDue, to, b.anchorDay)) {
      out.push({ kind: 'BILL', id: b.id, title: b.name, sub: C.describeFreq(b.frequency, b.everyN), amount: est, due: d, spread: C.isSpread(b.frequency, b.everyN), remind: b.remindDays });
    }
  }
  for (const i of data.installments) {
    C.plan(i.amount, i.total, i.paid, i.firstDue).unpaidDueIn(-1e9, to).forEach((d, k) => {
      out.push({ kind: 'INSTALLMENT', id: i.id, title: i.name, sub: `${i.paid + k + 1} of ${i.total} · ${i.type}`, amount: i.amount, due: d, remind: i.remindDays });
    });
  }
  for (const c of data.circles) {
    C.circle(c).plan.unpaidDueIn(-1e9, to).forEach((d, k) => {
      out.push({ kind: 'CIRCLE', id: c.id, title: `${c.name} share`, sub: `Month ${c.paid + k + 1} of ${c.months}`, amount: c.share, due: d, remind: c.remindDays });
    });
  }
  for (const l of data.loans) {
    if (l.dueDay == null || l.closed || l.dueDay >= to) continue;
    const lent = l.direction === 'LENT';
    out.push({ kind: 'LOAN', id: l.id, title: lent ? `${l.person} pays you back` : `Pay back ${l.person}`, sub: lent ? 'They owe you' : 'You owe', amount: remaining(l), due: l.dueDay, incoming: lent, remind: 1 });
  }
  return out.sort((a, b) => a.due - b.due);
}

export function payUpcoming(u) {
  if (u.kind === 'BILL') { const b = byId(data.bills, u.id); if (b) payBill(b); }
  if (u.kind === 'INSTALLMENT') { const i = byId(data.installments, u.id); if (i) payInstallment(i); }
  if (u.kind === 'CIRCLE') { const c = byId(data.circles, u.id); if (c) payCircle(c); }
  if (u.kind === 'LOAN') { const l = byId(data.loans, u.id); if (l) loanPayment(l, remaining(l)); }
}

export function setAside() {
  return data.bills.filter((b) => C.isSpread(b.frequency, b.everyN))
    .reduce((s, b) => s + C.monthlyShare(b.amount * rateOf(b.currency), b.frequency, b.everyN), 0) + (S().savingsPerMonth || 0);
}

export function home(today = C.todayEpoch()) {
  const s = S();
  const cycle = C.cycleFor(today, s.cycleStart);
  const txns = data.txns.filter((t) => cycle.contains(t.epochDay));
  const income = txns.filter((t) => t.type === 'INCOME').reduce((a, t) => a + base(t), 0);
  const spending = txns.filter((t) => t.type === 'EXPENSE' && !t.spread && t.epochDay <= today);
  const sum = (l) => l.reduce((a, t) => a + base(t), 0);
  const spentBefore = sum(spending.filter((t) => t.epochDay < today));
  const spentToday = sum(spending.filter((t) => t.epochDay === today));
  const everyday = sum(spending.filter((t) => !t.source));
  const salaryPosted = txns.some((t) => t.source === 'SALARY');
  const salaryExpected = s.salary > 0 && !salaryPosted && salaryDateIn(cycle, s.salaryDay) != null ? s.salary : 0;
  const all = upcoming(cycle.nextStart + 35);
  const commitments = all.filter((u) => !u.incoming && !u.spread && u.due < cycle.nextStart).reduce((a, u) => a + u.amount, 0);
  const aside = setAside();
  const b = C.computeBudget({ cycle, today, incomeReceived: income, salaryExpected, setAside: aside, spentBeforeToday: spentBefore, spentToday, commitments, everydaySpent: everyday });
  const perDay = {};
  for (const t of spending) perDay[t.epochDay] = (perDay[t.epochDay] || 0) + base(t);
  const days = [];
  for (let d = cycle.start; d <= today && d < cycle.nextStart; d++) days.push([d, perDay[d] || 0]);
  return {
    cycle, today, budget: b, days, dayReference: cycle.length > 0 ? b.budget / cycle.length : 0,
    upcoming: all.filter((u) => u.due < today + 35), setAside: aside, income, salaryExpected,
  };
}

/** Current balance of every wallet, in the base currency. */
export function balances() {
  const m = {};
  for (const w of data.wallets) m[w.id] = w.opening * rateOf(w.currency);
  for (const t of data.txns) {
    if (t.type === 'EXPENSE') m[t.walletId] = (m[t.walletId] || 0) - base(t);
    else if (t.type === 'INCOME') m[t.walletId] = (m[t.walletId] || 0) + base(t);
    else { m[t.walletId] = (m[t.walletId] || 0) - base(t); if (t.toWalletId) m[t.toWalletId] = (m[t.toWalletId] || 0) + base(t); }
  }
  return m;
}

/** Items to remind about today: due within each item's reminder window, or late. */
export function dueSoon(today = C.todayEpoch()) {
  return upcoming(today + 31).filter((u) => u.due - today <= (u.remind ?? 1));
}
