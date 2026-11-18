import * as C from './core.js';
import * as R from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = '1.0.0';

const ICON = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  spend: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  bills: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
  owe: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  more: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  left: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  right: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  share: 'M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6a2 2 0 0 1-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3a2 2 0 0 1 2 2z',
};
const icon = (n, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${ICON[n]}" fill="currentColor"/></svg>`;

const TABS = [['home', 'Home'], ['spend', 'Spend'], ['bills', 'Bills'], ['owe', 'Owe'], ['more', 'More']];

// ---------- UI state ----------

const ui = {
  stack: [{ r: 'home' }],
  spendOffset: 0, spendFilter: null, spendSearch: '',
  oweTab: 0, catKind: 'EXPENSE',
  locked: false, hiddenAt: 0,
  hideInstall: false,
};
try { ui.hideInstall = localStorage.getItem('pocketta-hide-install') === '1'; } catch { /* private mode */ }
const cur = () => ui.stack[ui.stack.length - 1];
const isTab = (r) => TABS.some((t) => t[0] === r);
function go(r, params = {}) { ui.stack = isTab(r) ? [{ r }] : [...ui.stack, { r, ...params }]; render(); window.scrollTo(0, 0); }
function back() { ui.stack = ui.stack.length > 1 ? ui.stack.slice(0, -1) : [{ r: 'home' }]; render(); }

// ---------- Small pieces ----------

const money = (v) => C.short(v);
const base = () => R.S().baseCurrency;
const card = (inner, cls = '', attrs = '') => `<section class="card ${cls}" ${attrs}>${inner}</section>`;
const label = (t) => `<div class="label">${esc(t)}</div>`;
const pill = (t, tone = '') => `<span class="pill ${tone}">${esc(t)}</span>`;
const progress = (f, tone = '') => `<div class="bar"><i class="${tone}" style="width:${Math.max(0, Math.min(1, f)) * 100}%"></i></div>`;
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const initial = (s) => `<span class="avatar" style="--h:${hue(s)}">${esc(String(s || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
function row(title, sub, { icon: ic, act, data = '', trailing = '' } = {}) {
  return `<div class="row ${act ? 'tap' : ''}" ${act ? `data-act="${act}" ${data}` : ''}>
    ${ic != null ? initial(ic) : ''}
    <div class="row-main"><div class="row-title">${esc(title)}</div>${sub ? `<div class="row-sub">${esc(sub)}</div>` : ''}</div>
    ${trailing}</div>`;
}
const fab = (text, act, data = '') => `<button class="fab" data-act="${act}" ${data}>${icon('add')}<span>${esc(text)}</span></button>`;
function chips(group, options, selected, cls = '') {
  return `<div class="chips ${cls}" data-group="${group}">${options.map(([v, l]) =>
    `<button type="button" class="chip ${String(v) === String(selected) ? 'on' : ''}" data-act="chip" data-val="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
}
const chipVal = (root, group) => $(`[data-group="${group}"] .chip.on`, root)?.dataset.val ?? null;
const field = (name, lbl, value = '', { type = 'text', mode, suffix, ph = '' } = {}) =>
  `<label class="field"><span>${esc(lbl)}</span><div class="input-wrap"><input name="${name}" type="${type}" ${mode ? `inputmode="${mode}"` : ''} value="${esc(value)}" placeholder="${esc(ph)}" autocomplete="off">${suffix ? `<em>${esc(suffix)}</em>` : ''}</div></label>`;
const numField = (name, lbl, value, opts = {}) => field(name, lbl, value === 0 || value == null ? (opts.keepZero ? '0' : '') : String(value), { mode: opts.int ? 'numeric' : 'decimal', ...opts });
const dateField = (name, lbl, ed) => `<label class="field"><span>${esc(lbl)}</span><div class="input-wrap"><input name="${name}" type="date" value="${ed != null ? C.isoOf(ed) : ''}"></div></label>`;
const check = (name, lbl, on) => `<label class="check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span>${esc(lbl)}</span></label>`;
const val = (root, name) => $(`[name="${name}"]`, root)?.value ?? '';
const num = (root, name) => C.parseNumber(val(root, name));
const checked = (root, name) => !!$(`[name="${name}"]`, root)?.checked;
const walletOpts = () => R.wallets().map((w) => [w.id, w.name]);

function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- Sheets (dialogs) ----------

function sheet({ title, body, saveLabel = 'Save', onSave, onDelete, deleteLabel = 'Delete', extra = '' }) {
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}">
    <div class="grip"></div><h2>${esc(title)}</h2>
    <form class="sheet-body" onsubmit="return false">${body}</form>
    <div class="sheet-actions">
      ${onDelete ? `<button class="btn text danger" data-s="del">${esc(deleteLabel)}</button>` : ''}
      <span class="grow"></span>${extra}
      <button class="btn text" data-s="cancel">Cancel</button>
      ${onSave ? `<button class="btn filled" data-s="save">${esc(saveLabel)}</button>` : ''}
    </div></div>`;
  document.body.appendChild(el);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => { el.classList.remove('open'); document.body.classList.remove('noscroll'); setTimeout(() => el.remove(), 200); };
  el.addEventListener('click', (e) => {
    if (e.target === el) return close();
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'cancel') close();
    if (b.dataset.s === 'del') {
      if (b.dataset.armed) { onDelete(el); close(); } else { b.dataset.armed = '1'; b.textContent = 'Tap again to delete'; }
    }
    if (b.dataset.s === 'save') {
      const err = onSave(el);
      if (typeof err === 'string') toast(err); else close();
    }
  });
  return { el, close };
}
function confirmSheet(title, text, yes, onYes) {
  sheet({ title, body: `<p>${esc(text)}</p>`, saveLabel: yes, onSave: () => { onYes(); } });
}

// ---------- Render ----------

function render() {
  const app = $('#app');
  if (ui.locked) { app.innerHTML = lockScreen(); $('#pin')?.focus(); return; }
  if (!R.S().onboarded) { app.innerHTML = onboarding(); return; }
  const c = cur();
  const pages = { home, spend, bills, owe, more, add, income, wallets, categories, currencyPage, settings };
  const page = pages[c.r === 'currencies' ? 'currencyPage' : c.r] || home;
  if (isTab(c.r)) {
    app.innerHTML = `<main class="page">${page(c)}</main>
      <nav class="tabs">${TABS.map(([r, l]) => `<button class="tab ${c.r === r ? 'on' : ''}" data-act="tab" data-r="${r}"><span class="ti">${icon(r)}</span><span>${l}</span></button>`).join('')}</nav>`;
  } else {
    app.innerHTML = page(c);
  }
  afterRender(c);
  updateBadge();
}

function topbar(title, actions = '') {
  return `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button><h1>${esc(title)}</h1>${actions}</header>`;
}

// ---------- Home ----------

function home() {
  R.ensureSalary();
  const s = R.home();
  const b = s.budget;
  const cur = base();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  let html = `<div class="head"><h1 class="title">${C.fmtMonth(s.cycle.end)}</h1>${pill(`${C.fmtDay(s.cycle.start)} → ${C.fmtDay(s.cycle.end)}`)}</div>`;
  if (ios && !ui.hideInstall) {
    html += card(`<div class="row-flex"><div class="grow"><b>Put Pocketta on your home screen</b><div class="small">In Safari tap ${icon('share', 16)} Share, then <b>Add to Home Screen</b>. It then opens like an app and works offline.</div></div>
      <button class="btn text" data-act="hide-install">OK</button></div>`, 'tonal');
  }
  html += ring(b, cur);
  if (b.budget <= 0 && s.salaryExpected <= 0) {
    html += card(`<b>Add your salary or income to see your budget</b><div class="small">More → Income & salary</div>`, 'tap', 'data-act="open" data-r="income"');
  }
  const over = b.leftToday < 0;
  html += card(`<div class="row-flex"><div class="grow">${label(over ? "Over today's budget" : 'Today you can spend')}<div class="big">${money(Math.abs(b.leftToday))} ${cur}</div></div>
    <div class="right"><div class="small">spent today</div><b>${money(b.dailyAllowance - b.leftToday)}</b><div class="small">daily ${money(b.dailyAllowance)}</div></div></div>`, over ? 'error' : 'primary');
  html += card(`<div class="row-flex"><div class="grow">${label('Month-end forecast')}<div class="mid">${money(b.forecastSpend)} ${cur}</div></div>
    ${b.forecastDiff >= 0 ? pill(`${money(b.forecastDiff)} under`, 'good') : pill(`${money(-b.forecastDiff)} over`, 'bad')}</div>`);
  if (s.days.length) html += card(label('This month, day by day') + dayBars(s));
  if (s.upcoming.length) {
    html += card(label('Coming up') + s.upcoming.slice(0, 6).map((u, i) => {
      const late = u.due < s.today;
      const can = u.due <= s.today + 3;
      return `<div class="row-flex line"><div class="grow"><div class="ellipsis">${esc(u.title)}</div><div class="small ${late ? 'bad-t' : ''}">${late ? 'Late · ' : ''}${C.fmtDay(u.due)}</div></div>
        <b class="${u.incoming ? 'good-t' : ''}">${u.incoming ? '+' : ''}${money(u.amount)}</b>
        ${can ? `<button class="btn text" data-act="pay-up" data-i="${i}">${u.incoming ? 'Got it' : 'Paid'}</button>` : ''}</div>`;
    }).join('') + `<div class="small">Amounts in ${cur}</div>`);
    ui.homeUpcoming = s.upcoming.slice(0, 6);
  }
  const line = (l, v, bold) => `<div class="kv ${bold ? 'bold' : ''}"><span>${esc(l)}</span><span>${v}</span></div>`;
  html += card(label('How the budget is made') +
    line('Income received', money(s.income)) +
    (s.salaryExpected > 0 ? line('Salary still coming', money(s.salaryExpected)) : '') +
    (s.setAside > 0 ? line('Set aside (yearly bills, savings)', '−' + money(s.setAside)) : '') +
    line('Spent so far', '−' + money(b.spent)) +
    line('Still to pay this month', '−' + money(b.committed)) +
    line('Left', money(b.left), true));
  return html + '<div class="spacer"></div>' + fab('Add', 'open', 'data-r="add"');
}

function ring(b, cur) {
  const r = 87, c = 2 * Math.PI * r;
  const spent = b.spentFraction * c, committed = b.committedFraction * c;
  const overC = b.left < 0 ? 'var(--error)' : 'var(--primary)';
  return `<div class="ring"><svg viewBox="0 0 190 190" width="190" height="190">
    <circle cx="95" cy="95" r="${r}" class="track"/>
    ${committed > 0 ? `<circle cx="95" cy="95" r="${r}" class="arc" style="stroke:var(--tertiary)" stroke-dasharray="${committed} ${c}" transform="rotate(${-90 + b.spentFraction * 360} 95 95)"/>` : ''}
    ${spent > 0 ? `<circle cx="95" cy="95" r="${r}" class="arc round" style="stroke:${overC}" stroke-dasharray="${spent} ${c}" transform="rotate(-90 95 95)"/>` : ''}
  </svg><div class="ring-in">${label('Left')}<div class="huge ${b.left < 0 ? 'bad-t' : ''}">${money(b.left)}</div>
    <div class="small">of ${money(b.budget)} ${cur}</div><div class="small">${b.daysLeft} days left</div></div></div>`;
}

function dayBars(s) {
  const days = s.days.slice(-31);
  const max = Math.max(...days.map((d) => d[1]), s.dayReference, 1);
  return `<div class="days">${days.map(([d, v]) => {
    const lv = v <= 0 ? 'empty' : C.level(v, s.dayReference);
    const h = v <= 0 ? 4 : Math.max(4, (v / max) * 64);
    return `<i class="${lv}" style="height:${h}px" title="${C.fmtDay(d)}: ${money(v)}"></i>`;
  }).join('')}</div>`;
}

// ---------- Spend ----------

function spendData() {
  const s = R.S();
  let cycle = C.cycleFor(C.todayEpoch(), s.cycleStart);
  for (let i = 0; i < ui.spendOffset; i++) cycle = C.previousCycle(cycle, s.cycleStart);
  const txns = R.data.txns.filter((t) => cycle.contains(t.epochDay));
  return { cycle, txns };
}
const topOf = (id) => { const c = R.byId(R.data.categories, id); return c ? (c.parentId ?? c.id) : null; };

function spend() {
  const { cycle, txns } = spendData();
  const exp = txns.filter((t) => t.type === 'EXPENSE');
  const spent = exp.reduce((a, t) => a + R.base(t), 0);
  const income = txns.filter((t) => t.type === 'INCOME').reduce((a, t) => a + R.base(t), 0);
  const per = {};
  for (const t of exp) { const k = topOf(t.categoryId) ?? 'none'; per[k] = (per[k] || 0) + R.base(t); }
  const perList = Object.entries(per).sort((a, b) => b[1] - a[1]);
  let html = `<div class="month-nav"><button class="icon-btn" data-act="spend-prev" aria-label="Previous month">${icon('left')}</button>
    <div class="center"><div class="mid">${C.fmtMonth(cycle.end)} ${C.ymd(cycle.end).y}</div><div class="small">${C.fmtDay(cycle.start)} → ${C.fmtDay(cycle.end)}</div></div>
    <button class="icon-btn" data-act="spend-next" ${ui.spendOffset === 0 ? 'disabled' : ''} aria-label="Next month">${icon('right')}</button></div>
    <div class="two">${card(label('Spent') + `<div class="big">${money(spent)}</div>`)}${card(label('Income') + `<div class="big good-t">${money(income)}</div>`)}</div>`;
  if (perList.length) {
    html += card(label('By category · tap to filter') + perList.map(([k, total]) => {
      const c = k === 'none' ? null : R.byId(R.data.categories, +k);
      const limit = c?.monthlyLimit || 0;
      const sel = String(ui.spendFilter) === String(k);
      const frac = limit > 0 ? total / limit : spent > 0 ? total / spent : 0;
      const lv = C.level(total, limit);
      return `<div class="catline tap" data-act="spend-filter" data-k="${k}"><div class="row-flex"><span class="grow ${sel ? 'sel' : ''}">${esc(c?.name ?? 'No category')}</span>
        <b>${limit > 0 ? `${money(total)} / ${money(limit)}` : `${money(total)} · ${spent > 0 ? Math.floor(total / spent * 100) : 0}%`}</b></div>${progress(frac, lv === 'ok' ? '' : lv)}</div>`;
    }).join(''));
  }
  html += `<div class="pad"><input class="search" id="spend-search" type="search" placeholder="Search notes and categories" value="${esc(ui.spendSearch)}"></div>
    <div id="spend-list">${spendList(txns)}</div><div class="spacer"></div>` + fab('Add', 'open', 'data-r="add"');
  return html;
}

function spendList(txns) {
  const q = ui.spendSearch.trim().toLowerCase();
  const shown = txns.filter((t) => (ui.spendFilter == null || String(topOf(t.categoryId) ?? 'none') === String(ui.spendFilter)) &&
    (!q || t.note.toLowerCase().includes(q) || R.categoryLabel(t.categoryId).toLowerCase().includes(q)));
  if (!shown.length) return `<p class="empty">Nothing here yet.</p>`;
  const groups = {};
  for (const t of shown) (groups[t.epochDay] ||= []).push(t);
  const today = C.todayEpoch();
  return Object.keys(groups).map(Number).sort((a, b) => b - a).map((d) => {
    const list = groups[d].sort((a, b) => b.createdAt - a.createdAt);
    const dayTotal = list.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + R.base(t), 0);
    const title = d === today ? 'Today' : d === today - 1 ? 'Yesterday' : C.fmtWeekday(d);
    return `<div class="day-h">${title} · ${money(dayTotal)}</div>` + list.map(txnRow).join('');
  }).join('');
}

function txnRow(t) {
  const cat = R.byId(R.data.categories, t.categoryId);
  const wn = (id) => R.byId(R.data.wallets, id)?.name ?? '';
  const title = t.note || cat?.name || (t.type === 'TRANSFER' ? 'Transfer' : '—');
  const sub = t.type === 'TRANSFER' ? `${wn(t.walletId)} → ${wn(t.toWalletId)}` : `${R.categoryLabel(t.categoryId)} · ${wn(t.walletId)}`;
  const sign = t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : '';
  const cls = t.type === 'INCOME' ? 'good-t' : t.type === 'TRANSFER' ? 'muted' : '';
  return row(title, sub, { icon: cat?.name ?? title, act: 'edit-txn', data: `data-id="${t.id}"`, trailing: `<b class="${cls}">${sign}${C.fmt(t.amount)}${t.currency !== base() ? ' ' + esc(t.currency) : ''}</b>` });
}

// ---------- Add / edit a transaction ----------

function add(c) {
  const editing = c.id ? R.byId(R.data.txns, c.id) : null;
  const st = c.st || (c.st = initAdd(c, editing));
  const s = R.S();
  const title = editing ? 'Edit' : st.type === 'INCOME' ? 'Add income' : st.type === 'TRANSFER' ? 'Move money' : 'Add expense';
  const wopts = walletOpts();
  return `${topbar(title, editing ? `<button class="icon-btn" data-act="del-txn" aria-label="Delete">${icon('del')}</button>` : '')}
  <main class="page form" id="add">
    ${editing?.source ? `<p class="small">This was recorded from a bill, installment, gam'eya or loan.</p>` : ''}
    ${chips('type', [['EXPENSE', 'Expense'], ['INCOME', 'Income'], ['TRANSFER', 'Transfer']], st.type, 'seg')}
    <div>${label('Amount')}<div class="amount" id="amt"></div><div class="small" id="qnote"></div></div>
    <label class="field"><span>${st.type === 'EXPENSE' ? 'Amount, or quick: koshary 60' : 'Amount'}</span>
      <div class="input-wrap"><input id="quick" name="quick" value="${esc(st.input)}" autocomplete="off" enterkeyhint="done" inputmode="${st.type === 'EXPENSE' ? 'text' : 'decimal'}"></div></label>
    <div id="cats"></div>
    <div id="borrow"></div>
    ${label(st.type === 'TRANSFER' ? 'From' : 'Wallet')}${chips('wallet', wopts, st.walletId)}
    ${st.type === 'TRANSFER' ? label('To') + chips('to', wopts, st.toWalletId) : ''}
    ${R.currencies().length > 1 ? label('Currency') + chips('currency', R.currencies().map((x) => [x, x]), st.currency) + `<div class="small" id="conv"></div>` : ''}
    ${label('Date')}${chips('day', [[C.todayEpoch(), 'Today'], [C.todayEpoch() - 1, 'Yesterday']], st.date)}
    ${dateField('date', 'Or pick a day', st.date)}
    ${field('note', 'Note (optional)', st.noteField)}
    <button class="btn filled wide" data-act="save-txn">Save</button>
    <div class="spacer"></div>
  </main>`;
}

function initAdd(c, t) {
  const s = R.S();
  const ws = R.wallets();
  if (t) {
    const cat = R.byId(R.data.categories, t.categoryId);
    return { type: t.type, input: String(t.amount), noteField: t.note, categoryId: t.categoryId, parentId: cat ? (cat.parentId ?? cat.id) : null, byHand: true, walletId: t.walletId, toWalletId: t.toWalletId, currency: t.currency, date: t.epochDay, person: '', due: null };
  }
  const walletId = (ws.find((w) => w.id === s.lastWallet) || ws[0])?.id ?? 0;
  const st = { type: c.type || 'EXPENSE', input: '', noteField: '', categoryId: null, parentId: null, byHand: false, walletId, toWalletId: ws.find((w) => w.id !== walletId)?.id ?? walletId, currency: s.baseCurrency, date: C.todayEpoch(), person: '', due: null };
  if (st.type === 'EXPENSE' && s.lastCategory) {
    const cat = R.categories().find((x) => x.id === s.lastCategory);
    if (cat) { st.categoryId = cat.id; st.parentId = cat.parentId ?? cat.id; }
  }
  return st;
}

function addRefresh() {
  const c = cur();
  const st = c.st;
  const root = $('#add');
  if (!root) return;
  const q = C.parseQuick(st.input);
  $('#amt').textContent = `${q.amount != null ? C.fmt(q.amount) : '0'} ${st.currency}`;
  $('#amt').classList.toggle('muted', q.amount == null);
  $('#qnote').textContent = q.note && !st.noteField ? `Note: ${q.note}` : '';
  if (!st.byHand && q.note && st.type !== 'TRANSFER') {
    const g = R.guessCategory(q.note, st.type);
    if (g) { st.categoryId = g; const cat = R.byId(R.data.categories, g); st.parentId = cat.parentId ?? cat.id; }
  }
  if (st.type !== 'TRANSFER') {
    const kind = st.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const cats = R.categories().filter((x) => x.kind === kind).sort((a, b) => a.sort - b.sort);
    const parents = cats.filter((x) => x.parentId == null);
    const subs = cats.filter((x) => x.parentId != null && x.parentId === st.parentId);
    $('#cats').innerHTML = label('Category') + chips('parent', parents.map((x) => [x.id, x.name]), st.parentId) +
      (subs.length ? chips('sub', subs.map((x) => [x.id, x.name]), st.categoryId, 'subs') : '');
  } else $('#cats').innerHTML = '';
  const catName = R.byId(R.data.categories, st.categoryId)?.name ?? '';
  const isBorrowed = st.type === 'INCOME' && catName.toLowerCase() === 'borrowed' && !c.id;
  const bw = $('#borrow');
  if (isBorrowed && !bw.dataset.on) {
    bw.dataset.on = '1';
    bw.innerHTML = field('person', 'Borrowed from', st.person) + dateField('due', 'Pay back by (optional)', st.due) + `<p class="small">This also goes to Owe → Loans as money you owe.</p>`;
  } else if (!isBorrowed) { bw.dataset.on = ''; bw.innerHTML = ''; }
  const conv = $('#conv');
  if (conv) conv.textContent = st.currency !== base() && q.amount != null ? `= ${C.fmt(q.amount * R.rateOf(st.currency))} ${base()}` : '';
  st.isBorrowed = isBorrowed;
}

function saveTxn() {
  const c = cur();
  const st = c.st;
  const root = $('#add');
  st.noteField = val(root, 'note');
  if (st.isBorrowed) { st.person = val(root, 'person'); st.due = C.fromIso(val(root, 'due')); }
  const q = C.parseQuick(st.input);
  const amount = q.amount;
  const note = st.noteField.trim() || q.note;
  if (!(amount > 0)) return toast('Type an amount first');
  if (!st.walletId) return toast('Pick a wallet');
  if (st.type === 'TRANSFER' && st.toWalletId === st.walletId) return toast('Pick two different wallets');
  if (st.type !== 'TRANSFER' && !st.categoryId) return toast('Pick a category');
  if (st.isBorrowed && !st.person.trim()) return toast('Who did you borrow from?');
  if (st.isBorrowed) {
    R.addLoan({ person: st.person.trim(), lent: false, amount: amount * R.rateOf(st.currency), walletId: st.walletId, day: st.date, due: st.due, note });
  } else {
    R.saveTxn({
      ...(c.id ? { id: c.id } : {}), type: st.type, amount, currency: st.currency, rate: R.rateOf(st.currency), walletId: st.walletId,
      toWalletId: st.type === 'TRANSFER' ? st.toWalletId : null, categoryId: st.type === 'TRANSFER' ? null : st.categoryId, note, epochDay: st.date,
    });
    if (st.type === 'EXPENSE' && !c.id) checkOverBudget();
  }
  back();
}

function checkOverBudget() {
  const s = R.S();
  if (!s.budgetAlert) return;
  const h = R.home();
  const b = h.budget;
  if (b.leftToday >= 0 || b.budget <= 0) return;
  const today = C.isoOf(h.today);
  if (s.overAlert === today) return;
  s.overAlert = today;
  R.changed();
  const tomorrow = b.daysLeft > 1 ? b.left / (b.daysLeft - 1) : 0;
  setTimeout(() => toast(`You're ${money(-b.leftToday)} ${base()} over today's budget. Tomorrow you can spend about ${money(Math.max(tomorrow, 0))}.`, 6000), 300);
}

// ---------- Bills ----------

function bills() {
  const s = R.S();
  const today = C.todayEpoch();
  const cycle = C.cycleFor(today, s.cycleStart);
  const list = [...R.data.bills].sort((a, b) => a.nextDue - b.nextDue);
  const monthly = list.reduce((a, b) => a + C.monthlyShare(b.amount * R.rateOf(b.currency), b.frequency, b.everyN), 0);
  const leftThis = list.reduce((a, b) => a + C.occurrences(b.nextDue, b.frequency, b.everyN, b.nextDue, cycle.nextStart, b.anchorDay).length * b.amount * R.rateOf(b.currency), 0);
  let html = `<h1 class="title pad-t">Bills & subscriptions</h1>` + card(`<div class="row-flex"><div class="grow">${label('Per month on average')}<div class="big">${money(monthly)} ${base()}</div></div>
    <div class="right"><div class="small">left to pay this month</div><b>${money(leftThis)}</b></div></div>
    <div class="small">Yearly and quarterly bills are spread over the months, so they never surprise you.</div>`, 'primary');
  if (!list.length) html += `<p class="empty">No bills yet. Add internet, mobile, electricity, Netflix, the gym...</p>`;
  html += list.map((b) => {
    const days = b.nextDue - today;
    const p = days < 0 ? pill('late', 'bad') : days === 0 ? pill('today', 'warn') : days <= 3 ? pill(`in ${days} d`, 'warn') : '';
    return row(b.name, `${C.describeFreq(b.frequency, b.everyN)} · due ${C.fmtDay(b.nextDue)}${b.kind === 'SUB' ? ' · subscription' : ''}`, {
      icon: b.name, act: 'edit-bill', data: `data-id="${b.id}"`,
      trailing: `${p}<b>${b.variable ? '~' : ''}${C.fmt(b.amount)}</b><button class="btn text" data-act="pay-bill" data-id="${b.id}">Paid</button>`,
    });
  }).join('');
  return html + '<div class="spacer"></div>' + fab('Bill', 'edit-bill', 'data-id="0"');
}

function billEditor(b) {
  const isNew = !b;
  const today = C.todayEpoch();
  b = b || { id: 0, name: '', amount: 0, currency: base(), frequency: 'MONTHLY', everyN: 30, anchorDay: C.ymd(today).d, nextDue: today, categoryId: null, walletId: null, remindDays: 1, variable: false, kind: 'BILL' };
  const body = chips('kind', [['BILL', 'Bill'], ['SUB', 'Subscription']], b.kind, 'seg') +
    field('name', 'Name', b.name) +
    numField('amount', 'Amount', b.amount, { suffix: b.currency }) +
    check('variable', 'Amount changes (use the average of the last 3)', b.variable) +
    (R.currencies().length > 1 ? chips('currency', R.currencies().map((x) => [x, x]), b.currency) : '') +
    label('Repeats') + chips('freq', C.FREQS, b.frequency) +
    `<div id="everyn" ${b.frequency === 'EVERY_N_DAYS' ? '' : 'hidden'}>${numField('everyN', 'Every how many days', b.everyN, { int: true })}</div>
    <div class="small" id="share"></div>` +
    dateField('due', 'Next due date', b.nextDue) +
    numField('remind', 'Remind me days before', b.remindDays, { int: true, keepZero: true }) +
    label('Pay from') + chips('wallet', walletOpts(), b.walletId ?? '') +
    (isNew ? '' : `<button type="button" class="btn tonal" data-act="skip-bill" data-id="${b.id}">Skip this time</button>`);
  const { el } = sheet({
    title: isNew ? 'New bill' : b.name, body,
    onDelete: isNew ? null : () => R.deleteBill(b),
    onSave: (root) => {
      const amount = num(root, 'amount');
      const name = val(root, 'name').trim();
      if (!name) return 'Give it a name';
      if (!(amount > 0)) return 'Type the amount';
      const due = C.fromIso(val(root, 'due')) ?? today;
      const freq = chipVal(root, 'freq') || 'MONTHLY';
      R.saveBill({
        ...b, name, amount, kind: chipVal(root, 'kind') || 'BILL', frequency: freq, everyN: Math.max(parseInt(val(root, 'everyN')) || 30, 1),
        nextDue: due, anchorDay: C.ymd(due).d, walletId: +chipVal(root, 'wallet') || null,
        remindDays: Math.min(Math.max(parseInt(val(root, 'remind')) || 0, 0), 30), variable: checked(root, 'variable'),
        currency: chipVal(root, 'currency') || b.currency, categoryId: b.categoryId ?? R.guessCategory(name, 'EXPENSE'),
      });
    },
  });
  const upd = () => {
    const f = chipVal(el, 'freq');
    $('#everyn', el).hidden = f !== 'EVERY_N_DAYS';
    const a = num(el, 'amount'), n = Math.max(parseInt(val(el, 'everyN')) || 30, 1);
    $('#share', el).textContent = a > 0 ? `≈ ${C.fmt(C.monthlyShare(a, f, n))} a month · ${C.fmt(C.monthlyShare(a, f, n) * 12)} a year` : '';
  };
  el.addEventListener('input', upd);
  el.addEventListener('click', () => setTimeout(upd));
  upd();
}

function payVariableBill(b) {
  sheet({
    title: `Pay ${b.name}`, saveLabel: 'Paid',
    body: numField('amount', 'Amount this time', Math.round(R.estimate(b) * 100) / 100, { suffix: b.currency }),
    onSave: (root) => { const a = num(root, 'amount'); if (!(a > 0)) return 'Type the amount'; R.payBill(b, a); },
  });
}

// ---------- Owe: installments, gam'eya, loans ----------

function owe() {
  const tabs = ['Installments', "Gam'eya", 'Loans'];
  return `<div class="subtabs">${tabs.map((t, i) => `<button class="${ui.oweTab === i ? 'on' : ''}" data-act="owe-tab" data-i="${i}">${t}</button>`).join('')}</div>` +
    [installmentsTab, circlesTab, loansTab][ui.oweTab]();
}

function installmentsTab() {
  const today = C.todayEpoch();
  const cycle = C.cycleFor(today, R.S().cycleStart);
  const items = R.data.installments;
  const circles = R.data.circles;
  const pl = (i) => C.plan(i.amount, i.total, i.paid, i.firstDue);
  const thisMonth = items.reduce((a, i) => a + pl(i).unpaidDueIn(-1e9, cycle.nextStart).length * i.amount, 0) +
    circles.reduce((a, c) => a + C.circle(c).plan.unpaidDueIn(-1e9, cycle.nextStart).length * c.share, 0);
  const owed = items.reduce((a, i) => a + pl(i).remainingAmount, 0) + circles.reduce((a, c) => a + C.circle(c).plan.remainingAmount, 0);
  const active = items.filter((i) => !pl(i).done), finished = items.filter((i) => pl(i).done);
  let html = card(`<div class="row-flex"><div class="grow">${label('Due this month')}<div class="big">${money(thisMonth)}</div></div>
    <div class="right"><div class="small">still owed in total</div><b>${money(owed)}</b></div></div>`, 'primary');
  if (!active.length && !circles.length) html += `<p class="empty">No installments yet. Add valU, Aman, Contact, a credit card plan, or your own type.</p>`;
  const instRow = (title, sub, p, amount, act, id, payAct) => {
    const late = p.nextDue != null && p.nextDue < today;
    return `<div>${row(title, sub, {
      icon: title, act, data: `data-id="${id}"`,
      trailing: `<div class="right"><b>${C.fmt(amount)}</b>${p.nextDue != null ? `<div class="small ${late ? 'bad-t' : ''}">${late ? 'late' : C.fmtDay(p.nextDue)}</div>` : ''}</div>
        <button class="btn text" data-act="${payAct}" data-id="${id}">Pay</button>`,
    })}<div class="row-bar">${progress(p.progress)}</div></div>`;
  };
  html += active.map((i) => instRow(i.name + (i.provider ? ` · ${i.provider}` : ''), `${i.type} · ${i.paid} of ${i.total} · ends ${C.fmtMonthYear(pl(i).endDate)}`, pl(i), i.amount, 'edit-inst', i.id, 'pay-inst')).join('');
  html += circles.filter((c) => c.paid < c.months).map((c) => instRow(c.name, `Gam'eya share · ${c.paid} of ${c.months}`, C.circle(c).plan, c.share, 'owe-tab" data-i="1', c.id, 'pay-circle')).join('');
  if (finished.length) html += `<div class="day-h">Finished</div>` + finished.map((i) => row(i.name, `${i.type} · paid off`, { icon: i.name, act: 'edit-inst', data: `data-id="${i.id}"`, trailing: pill('done', 'good') })).join('');
  return html + '<div class="spacer"></div>' + fab('Installment', 'edit-inst', 'data-id="0"');
}

const INST_TYPES = ['Consumer finance', 'Credit card', 'Phone / device', 'Car', 'Apartment'];
const PROVIDERS = ['valU', 'Aman', 'Contact', 'Souhoola', 'Halan', 'Sympl', 'Bank'];

function instEditor(it) {
  const isNew = !it;
  it = it || { id: 0, name: '', type: 'Consumer finance', provider: '', amount: 0, total: 12, paid: 0, firstDue: C.todayEpoch(), walletId: null, remindDays: 1 };
  const types = [...new Set([...INST_TYPES, ...R.data.installments.map((x) => x.type)])];
  const body = field('name', 'What is it (fridge, laptop...)', it.name) +
    label('Type') + chips('type', types.map((t) => [t, t]), it.type) + field('newType', 'Or a new type', '') +
    field('provider', 'Company / bank (optional)', it.provider) + chips('prov', PROVIDERS.map((p) => [p, p]), it.provider) +
    numField('amount', 'Monthly payment', it.amount) +
    `<div class="two">${numField('total', 'Months in total', it.total, { int: true })}${numField('paid', 'Already paid', it.paid, { int: true, keepZero: true })}</div>` +
    dateField('first', 'First payment date', it.firstDue) + `<div class="small" id="sum"></div>` +
    numField('remind', 'Remind me days before', it.remindDays, { int: true, keepZero: true }) +
    label('Pay from') + chips('wallet', walletOpts(), it.walletId ?? '');
  const { el } = sheet({
    title: isNew ? 'New installment' : it.name, body,
    onDelete: isNew ? null : () => R.deleteInstallment(it),
    onSave: (root) => {
      const name = val(root, 'name').trim(), a = num(root, 'amount'), t = parseInt(val(root, 'total'));
      if (!name) return 'What is it?';
      if (!(a > 0)) return 'Type the monthly payment';
      if (!(t > 0)) return 'How many months?';
      R.saveInstallment({
        ...it, name, type: val(root, 'newType').trim() || chipVal(root, 'type') || it.type, provider: val(root, 'provider').trim(),
        amount: a, total: t, paid: Math.min(Math.max(parseInt(val(root, 'paid')) || 0, 0), t), firstDue: C.fromIso(val(root, 'first')) ?? it.firstDue,
        walletId: +chipVal(root, 'wallet') || null, remindDays: Math.min(Math.max(parseInt(val(root, 'remind')) || 0, 0), 30),
      });
    },
  });
  const upd = () => {
    const a = num(el, 'amount'), t = parseInt(val(el, 'total')), first = C.fromIso(val(el, 'first'));
    const pv = chipVal(el, 'prov');
    if (pv && document.activeElement?.name !== 'provider') $('[name="provider"]', el).value = pv;
    if (a > 0 && t > 0 && first != null) {
      const p = C.plan(a, t, parseInt(val(el, 'paid')) || 0, first);
      $('#sum', el).textContent = `Total ${C.fmt(a * t)} · ends ${C.fmtMonthYear(p.endDate)} · ${C.fmt(p.remainingAmount)} left`;
    } else $('#sum', el).textContent = '';
  };
  el.addEventListener('input', upd);
  el.addEventListener('click', () => setTimeout(upd));
  upd();
}

function circlesTab() {
  const today = C.todayEpoch();
  const list = R.data.circles;
  let html = list.length ? '' : `<p class="empty">No gam'eya yet. Add your share, how many months, and your turn.</p>`;
  html += list.map((c) => {
    const cc = C.circle(c);
    const turns = Array.from({ length: Math.min(c.months, 24) }, (_, k) => {
      const m = k + 1;
      const cls = m === c.myTurn ? 'mine' : m <= c.paid ? 'done' : '';
      return `<i class="${cls} ${m === c.paid + 1 ? 'now' : ''}">${m}</i>`;
    }).join('');
    const payoutPast = cc.payoutDate <= today;
    return card(`<div class="row-flex"><b class="grow mid">${esc(c.name)}</b>${c.paid >= c.months ? pill('finished', 'good') : pill(`Month ${cc.currentMonth} of ${c.months}`)}</div>
      <div class="small">${C.fmt(c.share)} a month · pot ${C.fmt(cc.payout)} ${base()}</div>
      <div class="turns">${turns}</div>
      <div>${c.payoutReceived ? `You collected ${C.fmt(cc.payout)} (month ${c.myTurn}).` : `Your turn: month ${c.myTurn} · ${C.fmtMonthYear(cc.payoutDate)} · +${C.fmt(cc.payout)}`}</div>
      ${c.payoutReceived && c.paid < c.months ? `<div class="small">Still to pay after collecting: ${C.fmt((c.months - c.paid) * c.share)}</div>` : ''}
      <div class="btns">${cc.plan.nextDue != null ? `<button class="btn outline" data-act="pay-circle" data-id="${c.id}">Pay share · ${C.fmtDay(cc.plan.nextDue)}</button>` : ''}
      ${!c.payoutReceived && payoutPast ? `<button class="btn outline" data-act="payout" data-id="${c.id}">Got payout</button>` : ''}</div>`, 'tap', `data-act="edit-circle" data-id="${c.id}"`);
  }).join('');
  return html + '<div class="spacer"></div>' + fab("Gam'eya", 'edit-circle', 'data-id="0"');
}

function circleEditor(c) {
  const isNew = !c;
  c = c || { id: 0, name: '', share: 0, months: 10, myTurn: 1, paid: 0, firstDue: C.todayEpoch(), payoutReceived: false, walletId: null, remindDays: 1 };
  const body = field('name', 'Name (office, family...)', c.name) + numField('share', 'My share per month', c.share) +
    `<div class="two">${numField('months', 'Months / members', c.months, { int: true })}${numField('turn', 'My turn', c.myTurn, { int: true })}</div>` +
    dateField('first', 'First payment date', c.firstDue) + numField('paid', 'Shares already paid', c.paid, { int: true, keepZero: true }) +
    check('received', 'I already collected my payout', c.payoutReceived) + `<div class="small" id="sum"></div>` +
    numField('remind', 'Remind me days before', c.remindDays, { int: true, keepZero: true }) + label('Pay from') + chips('wallet', walletOpts(), c.walletId ?? '');
  const { el } = sheet({
    title: isNew ? "New gam'eya" : c.name, body,
    onDelete: isNew ? null : () => R.deleteCircle(c),
    onSave: (root) => {
      const name = val(root, 'name').trim(), s = num(root, 'share'), m = parseInt(val(root, 'months')), t = parseInt(val(root, 'turn'));
      if (!name) return 'Give it a name';
      if (!(s > 0)) return 'Type your monthly share';
      if (!(m > 0)) return 'How many months?';
      if (!(t >= 1 && t <= m)) return `Your turn must be 1 to ${m}`;
      R.saveCircle({
        ...c, name, share: s, months: m, myTurn: t, paid: Math.min(Math.max(parseInt(val(root, 'paid')) || 0, 0), m),
        firstDue: C.fromIso(val(root, 'first')) ?? c.firstDue, payoutReceived: checked(root, 'received'),
        walletId: +chipVal(root, 'wallet') || null, remindDays: Math.min(Math.max(parseInt(val(root, 'remind')) || 0, 0), 30),
      });
    },
  });
  const upd = () => {
    const s = num(el, 'share'), m = parseInt(val(el, 'months')), t = parseInt(val(el, 'turn')), f = C.fromIso(val(el, 'first'));
    $('#sum', el).textContent = s > 0 && m > 0 && t >= 1 && t <= m && f != null
      ? `You collect ${C.fmt(s * m)} in ${C.fmtMonthYear(C.circle({ share: s, months: m, myTurn: t, paid: 0, firstDue: f }).payoutDate)}` : '';
  };
  el.addEventListener('input', upd);
  upd();
}

function loansTab() {
  const today = C.todayEpoch();
  const loans = [...R.data.loans].sort((a, b) => (a.closed - b.closed) || b.epochDay - a.epochDay);
  const owedToMe = loans.filter((l) => l.direction === 'LENT' && !l.closed).reduce((a, l) => a + R.remaining(l), 0);
  const iOwe = loans.filter((l) => l.direction !== 'LENT' && !l.closed).reduce((a, l) => a + R.remaining(l), 0);
  let html = `<div class="two">${card(label('They owe you') + `<div class="big good-t">${money(owedToMe)}</div>`)}${card(label('You owe') + `<div class="big bad-t">${money(iOwe)}</div>`)}</div>`;
  if (!loans.length) html += `<p class="empty">No loans. Money you lend or borrow shows up here.</p>`;
  html += loans.map((l) => {
    const lent = l.direction === 'LENT';
    let sub = `${lent ? 'Lent' : 'Borrowed'} ${C.fmtDay(l.epochDay)}`;
    if (l.repaid > 0) sub += ` · paid ${C.fmt(l.repaid)} of ${C.fmt(l.amount)}`;
    if (l.dueDay != null && !l.closed) sub += ` · by ${C.fmtDay(l.dueDay)}`;
    if (l.note) sub += ` · ${l.note}`;
    const p = l.closed ? pill('settled', 'good') : l.dueDay != null && l.dueDay < today ? pill('late', 'bad') : '';
    const cls = l.closed ? 'muted' : lent ? 'good-t' : 'bad-t';
    return row(l.person, sub, { icon: l.person, act: 'open-loan', data: `data-id="${l.id}"`, trailing: `${p}<b class="${cls}">${lent ? '+' : '−'}${C.fmt(l.closed ? l.amount : R.remaining(l))}</b>` });
  }).join('');
  return html + '<div class="spacer"></div>' + fab('Loan', 'new-loan');
}

function newLoan() {
  const body = chips('dir', [['LENT', 'I lent money'], ['BORROWED', 'I borrowed money']], 'LENT', 'seg') +
    field('person', 'To / from whom', '') + numField('amount', 'Amount', null, { suffix: base() }) +
    dateField('date', 'Date', C.todayEpoch()) + dateField('due', 'Pay back by (optional)', null) + field('note', 'Note (optional)', '') +
    check('record', 'Record the money in my wallet too', true) + label('Wallet') + chips('wallet', walletOpts(), R.wallets()[0]?.id ?? '');
  sheet({
    title: 'New loan', body,
    onSave: (root) => {
      const person = val(root, 'person').trim(), a = num(root, 'amount');
      if (!person) return 'Who is it?';
      if (!(a > 0)) return 'Type the amount';
      R.addLoan({ person, lent: chipVal(root, 'dir') === 'LENT', amount: a, walletId: +chipVal(root, 'wallet') || null, day: C.fromIso(val(root, 'date')) ?? C.todayEpoch(), due: C.fromIso(val(root, 'due')), note: val(root, 'note').trim(), record: checked(root, 'record') });
    },
  });
}

function loanDialog(l) {
  const lent = l.direction === 'LENT';
  const rem = R.remaining(l);
  const msg = `Hi ${l.person}, just a friendly reminder about the ${C.fmt(rem)} ${base()}${l.dueDay != null ? ` (due ${C.fmtDay(l.dueDay)})` : ''}. Thanks!`;
  const body = `<p>${esc(lent ? `${l.person} owes you ` : `You owe ${l.person} `)}<b>${C.fmt(rem)} ${base()}</b>${l.repaid > 0 ? esc(` (paid ${C.fmt(l.repaid)} of ${C.fmt(l.amount)})`) : ''}</p>` +
    (l.closed ? '' : numField('pay', lent ? 'Amount they paid back' : 'Amount you paid back', Math.round(rem * 100) / 100)) +
    dateField('due', 'Pay back by', l.dueDay) +
    (lent && !l.closed ? `<a class="btn outline" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Send a WhatsApp reminder</a>` : '');
  sheet({
    title: l.person, body, saveLabel: l.closed ? 'Save' : lent ? 'Got it back' : 'I paid',
    onDelete: () => R.deleteLoan(l),
    onSave: (root) => {
      const due = C.fromIso(val(root, 'due'));
      const x = R.byId(R.data.loans, l.id);
      if (x && due !== x.dueDay) { x.dueDay = due; R.changed(); }
      if (!l.closed) { const a = num(root, 'pay'); if (a > 0) R.loanPayment(l, a); }
    },
  });
}

// ---------- More ----------

function more() {
  return `<h1 class="title pad-t">More</h1>` +
    row('Income & salary', 'Your monthly salary, other income, money set aside', { icon: 'I', act: 'open', data: 'data-r="income"' }) +
    row('Wallets', 'Cash, bank, Vodafone Cash, cards and balances', { icon: 'W', act: 'open', data: 'data-r="wallets"' }) +
    row('Categories', 'Categories, sub-categories and monthly limits', { icon: 'C', act: 'open', data: 'data-r="categories"' }) +
    row('Currencies', 'Dollar, euro... with your own rate', { icon: '$', act: 'open', data: 'data-r="currencies"' }) +
    row('Settings', 'Month start, PIN lock, backup', { icon: 'S', act: 'open', data: 'data-r="settings"' });
}

function income() {
  const s = R.S();
  const cycle = C.cycleFor(C.todayEpoch(), s.cycleStart);
  const incomes = R.data.txns.filter((t) => t.type === 'INCOME' && cycle.contains(t.epochDay)).sort((a, b) => b.epochDay - a.epochDay);
  return topbar('Income & salary') + `<main class="page" id="income">` +
    card(label('Monthly salary') + `<div class="small">Added by itself every month on its day. If one month is different, edit it in Spend.</div>` +
      numField('salary', 'Salary', s.salary, { suffix: base() }) + numField('salaryDay', 'Day of the month it arrives', s.salaryDay, { int: true }) +
      label('Goes into') + chips('wallet', walletOpts(), s.salaryWallet || R.wallets()[0]?.id) +
      numField('savings', 'Set aside for savings each month (optional)', s.savingsPerMonth, { suffix: base() }) +
      `<button class="btn filled" data-act="save-income">Save</button>`) +
    `<div class="row-flex pad"><div class="label grow">Income this month · ${money(incomes.reduce((a, t) => a + R.base(t), 0))}</div><button class="btn outline" data-act="open" data-r="add" data-type="INCOME">Add income</button></div>` +
    (incomes.length ? incomes.map(txnRow).join('') : `<p class="empty">Nothing yet this month.</p>`) +
    `<p class="small pad">Other income: gam'eya payout, borrowed money (also saved as a debt), side work, gifts. Pick the category when you add it.</p></main>`;
}

const WALLET_TYPES = [['CASH', 'Cash'], ['BANK', 'Bank'], ['MOBILE', 'Mobile wallet'], ['CARD', 'Credit card'], ['OTHER', 'Other']];
function wallets() {
  const bal = R.balances();
  const ws = R.wallets();
  return topbar('Wallets', `<button class="icon-btn" data-act="edit-wallet" data-id="0" aria-label="Add wallet">${icon('add')}</button>`) + `<main class="page">` +
    card(label('Total') + `<div class="big">${money(ws.reduce((a, w) => a + (bal[w.id] || 0), 0))} ${base()}</div><button class="btn text" data-act="open" data-r="add" data-type="TRANSFER">Move money between wallets</button>`, 'primary') +
    ws.map((w) => {
      const b = bal[w.id] || 0;
      const shown = w.currency !== base() ? b / R.rateOf(w.currency) : b;
      return row(w.name, (WALLET_TYPES.find((t) => t[0] === w.type)?.[1] ?? 'Other') + (w.currency !== base() ? ` · ${w.currency}` : ''), { icon: w.name, act: 'edit-wallet', data: `data-id="${w.id}"`, trailing: `<b class="${b < 0 ? 'bad-t' : ''}">${C.fmt(shown)}</b>` });
    }).join('') + `<p class="small pad">Balances start from the opening amount you set and follow everything you record.</p></main>`;
}

function walletEditor(w) {
  const isNew = !w;
  w = w || { id: 0, name: '', type: 'CASH', currency: base(), opening: 0, sort: R.data.wallets.length, archived: false };
  const balance = R.balances()[w.id];
  const body = field('name', 'Name', w.name) + chips('type', WALLET_TYPES, w.type) +
    (R.currencies().length > 1 ? chips('currency', R.currencies().map((x) => [x, x]), w.currency) : '') +
    numField('opening', 'Opening balance', w.opening, { suffix: w.currency }) +
    (isNew ? '' : numField('actual', 'Or: how much is in it right now?', null, { suffix: w.currency }) + `<div class="small">We'll fix the balance to match.</div>`);
  sheet({
    title: isNew ? 'New wallet' : w.name, body,
    onDelete: isNew ? null : () => { const x = R.byId(R.data.wallets, w.id); x.archived = true; R.changed(); },
    onSave: (root) => {
      const name = val(root, 'name').trim();
      if (!name) return 'Give it a name';
      const currency = chipVal(root, 'currency') || w.currency;
      let o = num(root, 'opening') || 0;
      const real = num(root, 'actual');
      if (real != null && balance != null) o += (real * R.rateOf(currency) - balance) / R.rateOf(currency);
      const nw = { ...w, name, type: chipVal(root, 'type') || w.type, currency, opening: o };
      if (isNew) R.data.wallets.push({ ...nw, id: R.nextId() });
      else Object.assign(R.byId(R.data.wallets, w.id), nw);
      R.changed();
    },
  });
}

function categories() {
  const list = R.categories().filter((c) => c.kind === ui.catKind).sort((a, b) => a.sort - b.sort);
  const parents = list.filter((c) => c.parentId == null);
  return topbar('Categories', `<button class="icon-btn" data-act="edit-cat" data-id="0" aria-label="Add category">${icon('add')}</button>`) + `<main class="page">` +
    `<div class="pad">${chips('catkind', [['EXPENSE', 'Spending'], ['INCOME', 'Income']], ui.catKind, 'seg')}</div>` +
    parents.map((p) => row(p.name, p.monthlyLimit > 0 ? `Limit ${C.fmt(p.monthlyLimit)} a month` : '', {
      icon: p.name, act: 'edit-cat', data: `data-id="${p.id}"`,
      trailing: ui.catKind === 'EXPENSE' ? `<button class="btn text" data-act="add-sub" data-id="${p.id}">+ Sub</button>` : '',
    }) + list.filter((c) => c.parentId === p.id).map((c) => `<div class="indent">${row(c.name, '', { act: 'edit-cat', data: `data-id="${c.id}"` })}</div>`).join('')).join('') + `</main>`;
}

function catEditor(c, parentId = null) {
  const isNew = !c;
  c = c || { id: 0, name: '', parentId, kind: ui.catKind, monthlyLimit: 0, sort: R.data.categories.length, archived: false };
  const body = field('name', 'Name', c.name) +
    (c.parentId == null && c.kind === 'EXPENSE' ? numField('limit', 'Monthly limit (optional)', c.monthlyLimit) + `<div class="small">The bar turns amber near the limit and red when you go over.</div>` : '') +
    (isNew ? '' : `<div class="small">Deleting hides it. Past records keep it.</div>`);
  sheet({
    title: isNew ? (parentId ? 'New sub-category' : 'New category') : c.name, body,
    onDelete: isNew ? null : () => { R.byId(R.data.categories, c.id).archived = true; R.changed(); },
    onSave: (root) => {
      const name = val(root, 'name').trim();
      if (!name) return 'Give it a name';
      const nc = { ...c, name, monthlyLimit: num(root, 'limit') || 0 };
      if (isNew) R.data.categories.push({ ...nc, id: R.nextId() }); else Object.assign(R.byId(R.data.categories, c.id), nc);
      R.changed();
    },
  });
}

function currencyPage() {
  const s = R.S();
  const rates = Object.entries(s.rates).sort();
  return topbar('Currencies') + `<main class="page" id="cur">` +
    card(label('Main currency') + `<div class="row-flex">${field('base', 'Code', s.baseCurrency)}<button class="btn text" data-act="save-base">Save</button></div><div class="small">Everything is totalled in this currency.</div>`) +
    `<div class="pad">${label('Other currencies')}${rates.length ? '' : '<div class="muted">None yet.</div>'}</div>` +
    rates.map(([c, r]) => `<div class="row-flex pad line"><span class="grow">1 ${esc(c)} = ${C.fmt(r)} ${esc(s.baseCurrency)}</span><button class="btn text" data-act="edit-rate" data-c="${esc(c)}">Edit</button><button class="btn text" data-act="del-rate" data-c="${esc(c)}">Remove</button></div>`).join('') +
    card(label('Add or update a rate') + `<div class="two">${field('code', 'Code (USD)', '')}${numField('rate', 'Rate', null)}</div><button class="btn filled" data-act="save-rate">Save rate</button>
      <div class="small">Rates are yours to set and are saved with each record when you add it.</div>`) + `</main>`;
}

// ---------- Settings ----------

function settings() {
  const s = R.S();
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return topbar('Settings') + `<main class="page" id="settings">` +
    card(label('Month') + `<div class="row-flex">${numField('start', 'My month starts on day', s.cycleStart, { int: true })}<button class="btn text" data-act="save-start">Save</button></div>`) +
    card(label('Alerts') + `<label class="switch-row"><span>Tell me when I go over today's budget</span><input type="checkbox" data-act="toggle-alert" ${s.budgetAlert ? 'checked' : ''}></label>
      <div class="small">Bills, installments and gam'eya shares that are due soon (by the days you choose on each one) show on Home and as a number on the app icon.</div>`) +
    card(label('Privacy') + (s.pinHash
      ? `<div class="row-flex"><span class="grow">PIN lock is on</span><button class="btn text" data-act="pin-set">Change</button><button class="btn text danger" data-act="pin-off">Turn off</button></div>`
      : `<div class="row-flex"><span class="grow">Lock the app with a PIN</span><button class="btn tonal" data-act="pin-set">Set PIN</button></div>`) +
      `<div class="small">Asked when you open the app or come back after a minute.</div>`) +
    card(label('Backup') + `<div class="small">Everything is on this phone only, inside the browser. Save a backup file now and then (to Files, Drive, or WhatsApp to yourself). If you clear Safari's website data, the app's data goes too.</div>
      <div class="btns"><button class="btn outline" data-act="backup">Save backup</button><button class="btn outline" data-act="restore">Restore</button></div>
      <input type="file" id="restore-file" accept=".json,application/json" hidden>`) +
    card(label('About') + `<div>Pocketta web ${VERSION}${standalone ? ' · on home screen' : ''}</div>
      <div class="small">Updates come by themselves the next time you open it with internet.</div>
      <button class="btn text danger" data-act="wipe">Delete all data</button>`) + `</main>`;
}

// ---------- Onboarding & lock ----------

function onboarding() {
  return `<main class="page onboard" id="onb"><h1 class="brand">Pocketta</h1>
    <p>Your money for the month: what you can spend today, your bills, installments, gam'eya and loans. Everything stays on your phone.</p>
    ${numField('salary', 'Monthly salary (optional)', null, { suffix: 'EGP' })}
    ${numField('salaryDay', 'Salary day of the month', 1, { int: true })}
    ${numField('start', 'My month starts on day', 1, { int: true })}
    <div class="small">Most people pick the day the salary arrives.</div>
    ${numField('savings', 'Save every month (optional)', null, { suffix: 'EGP' })}
    <button class="btn filled wide" data-act="start">Start</button>
    <div class="small">You can change all of this later in More.</div></main>`;
}

function lockScreen() {
  return `<main class="lock"><h1 class="brand">Pocketta</h1><p>Enter your PIN</p>
    <input id="pin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off">
    <div class="small" id="pin-msg"></div>
    <p class="small muted">Forgot it? Remove the app's website data in Safari settings to start over (this deletes your data).</p></main>`;
}

async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pinSheet() {
  sheet({
    title: 'Set a PIN', body: numField('p1', 'New PIN (4 to 8 digits)', null, { int: true, type: 'password' }) + numField('p2', 'Type it again', null, { int: true, type: 'password' }),
    onSave: (root) => {
      const p1 = val(root, 'p1'), p2 = val(root, 'p2');
      if (!/^\d{4,8}$/.test(p1)) return 'Use 4 to 8 digits';
      if (p1 !== p2) return "The two PINs don't match";
      const salt = crypto.getRandomValues(new Uint32Array(2)).join('-');
      hashPin(p1, salt).then((h) => { R.S().pinSalt = salt; R.setSetting('pinHash', h); toast('PIN lock is on'); });
    },
  });
}

// ---------- After render hooks ----------

function afterRender(c) {
  if (c.r === 'add') {
    addRefresh();
    const q = $('#quick');
    if (!c.id && !c.focused) { c.focused = true; setTimeout(() => q.focus(), 60); }
    q.addEventListener('input', () => { c.st.input = q.value; addRefresh(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveTxn(); } });
    $('[name="date"]').addEventListener('change', (e) => { const d = C.fromIso(e.target.value); if (d != null) { c.st.date = d; syncChips('day', d); } });
    $('[name="note"]').addEventListener('input', (e) => { c.st.noteField = e.target.value; addRefresh(); });
  }
  if (c.r === 'spend') {
    const s = $('#spend-search');
    s.addEventListener('input', () => { ui.spendSearch = s.value; $('#spend-list').innerHTML = spendList(spendData().txns); });
  }
}
function syncChips(group, v) { document.querySelectorAll(`[data-group="${group}"] .chip`).forEach((b) => b.classList.toggle('on', b.dataset.val === String(v))); }

async function updateBadge() {
  try {
    const n = R.S().onboarded ? R.dueSoon().length : 0;
    if (navigator.setAppBadge) n ? await navigator.setAppBadge(n) : await navigator.clearAppBadge();
  } catch { /* not supported */ }
}

// ---------- Actions ----------

const actions = {
  tab: (el) => go(el.dataset.r),
  open: (el) => go(el.dataset.r, el.dataset.type ? { type: el.dataset.type } : {}),
  back: () => back(),
  'hide-install': () => { ui.hideInstall = true; try { localStorage.setItem('pocketta-hide-install', '1'); } catch { /* fine */ } render(); },
  'pay-up': (el) => { const u = ui.homeUpcoming?.[+el.dataset.i]; if (u) { R.payUpcoming(u); toast(u.incoming ? 'Recorded' : 'Paid'); } },
  chip: (el) => {
    const g = el.closest('[data-group]');
    const group = g.dataset.group;
    const multiOff = ['wallet', 'prov'].includes(group) && el.classList.contains('on') && el.closest('.sheet');
    g.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b === el && !multiOff));
    const c = cur();
    if (c.r === 'add' && !el.closest('.sheet')) {
      const st = c.st, v = el.dataset.val;
      if (group === 'type' && v !== st.type) { st.type = v; st.categoryId = null; st.parentId = null; st.byHand = false; render(); return; }
      if (group === 'parent') { st.parentId = +v; st.categoryId = +v; st.byHand = true; addRefresh(); }
      if (group === 'sub') { st.categoryId = st.categoryId === +v ? st.parentId : +v; st.byHand = true; addRefresh(); }
      if (group === 'wallet') st.walletId = +v;
      if (group === 'to') st.toWalletId = +v;
      if (group === 'currency') { st.currency = v; addRefresh(); }
      if (group === 'day') { st.date = +v; $('[name="date"]').value = C.isoOf(+v); }
    }
    if (group === 'catkind') { ui.catKind = el.dataset.val; render(); }
  },
  'save-txn': () => saveTxn(),
  'edit-txn': (el) => go('add', { id: +el.dataset.id }),
  'del-txn': () => {
    const t = R.byId(R.data.txns, cur().id);
    if (t) confirmSheet('Delete this?', `${t.note || 'This record'} · ${C.fmt(t.amount)} ${t.currency}`, 'Delete', () => { R.deleteTxn(t); back(); });
  },
  'spend-prev': () => { ui.spendOffset++; ui.spendFilter = null; render(); },
  'spend-next': () => { if (ui.spendOffset > 0) { ui.spendOffset--; ui.spendFilter = null; render(); } },
  'spend-filter': (el) => { ui.spendFilter = String(ui.spendFilter) === el.dataset.k ? null : el.dataset.k; render(); },
  'edit-bill': (el) => billEditor(R.byId(R.data.bills, +el.dataset.id)),
  'pay-bill': (el) => { const b = R.byId(R.data.bills, +el.dataset.id); if (!b) return; if (b.variable) payVariableBill(b); else { R.payBill(b); toast(`${b.name} paid`); } },
  'skip-bill': (el) => { const b = R.byId(R.data.bills, +el.dataset.id); if (b) { R.skipBill(b); document.querySelector('.scrim [data-s="cancel"]')?.click(); toast('Skipped to the next date'); } },
  'owe-tab': (el) => { ui.oweTab = +el.dataset.i; render(); },
  'edit-inst': (el) => instEditor(R.byId(R.data.installments, +el.dataset.id)),
  'pay-inst': (el) => { const i = R.byId(R.data.installments, +el.dataset.id); if (i) { R.payInstallment(i); toast('Paid'); } },
  'edit-circle': (el) => circleEditor(R.byId(R.data.circles, +el.dataset.id)),
  'pay-circle': (el) => { const c = R.byId(R.data.circles, +el.dataset.id); if (c) { R.payCircle(c); toast('Share paid'); } },
  payout: (el) => { const c = R.byId(R.data.circles, +el.dataset.id); if (c) { R.receivePayout(c); toast('Payout recorded'); } },
  'new-loan': () => newLoan(),
  'open-loan': (el) => { const l = R.byId(R.data.loans, +el.dataset.id); if (l) loanDialog(l); },
  'save-income': () => {
    const root = $('#income');
    R.S().salary = num(root, 'salary') || 0;
    R.S().salaryDay = Math.min(Math.max(parseInt(val(root, 'salaryDay')) || 1, 1), 31);
    R.S().salaryWallet = +chipVal(root, 'wallet') || R.wallets()[0]?.id || 0;
    R.S().savingsPerMonth = num(root, 'savings') || 0;
    R.changed();
    R.ensureSalary();
    toast('Saved');
  },
  'edit-wallet': (el) => walletEditor(R.byId(R.data.wallets, +el.dataset.id)),
  'edit-cat': (el) => catEditor(R.byId(R.data.categories, +el.dataset.id)),
  'add-sub': (el) => catEditor(null, +el.dataset.id),
  'save-base': () => { const v = val($('#cur'), 'base').trim().toUpperCase().slice(0, 4); if (v) { R.setSetting('baseCurrency', v); toast('Saved'); } },
  'edit-rate': (el) => { const root = $('#cur'); $('[name="code"]', root).value = el.dataset.c; $('[name="rate"]', root).value = R.S().rates[el.dataset.c]; },
  'del-rate': (el) => { const r = { ...R.S().rates }; delete r[el.dataset.c]; R.setSetting('rates', r); },
  'save-rate': () => {
    const root = $('#cur');
    const code = val(root, 'code').trim().toUpperCase().slice(0, 4), r = num(root, 'rate');
    if (!code || !(r > 0) || code === base()) return toast('Type a code and a rate');
    R.setSetting('rates', { ...R.S().rates, [code]: r });
  },
  'save-start': () => { R.setSetting('cycleStart', Math.min(Math.max(parseInt(val($('#settings'), 'start')) || 1, 1), 31)); toast('Saved'); },
  'toggle-alert': (el) => R.setSetting('budgetAlert', el.checked),
  'pin-set': () => pinSheet(),
  'pin-off': () => confirmSheet('Turn off the PIN?', 'Anyone with your phone can open Pocketta.', 'Turn off', () => { R.S().pinSalt = ''; R.setSetting('pinHash', ''); }),
  backup: () => backup(),
  restore: () => $('#restore-file').click(),
  wipe: () => confirmSheet('Delete all data?', 'Everything in Pocketta on this phone will be deleted. Save a backup first if you may need it.', 'Delete all', () => { R.wipe(); ui.stack = [{ r: 'home' }]; render(); }),
  start: () => {
    const root = $('#onb');
    R.ensureSeeded();
    const s = R.S();
    s.cycleStart = Math.min(Math.max(parseInt(val(root, 'start')) || 1, 1), 31);
    s.salary = num(root, 'salary') || 0;
    s.salaryDay = Math.min(Math.max(parseInt(val(root, 'salaryDay')) || 1, 1), 31);
    s.savingsPerMonth = num(root, 'savings') || 0;
    s.onboarded = true;
    R.changed();
    R.ensureSalary();
  },
};

async function backup() {
  const text = R.exportJson();
  const name = `pocketta-backup-${C.isoOf(C.todayEpoch())}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Pocketta backup' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

document.addEventListener('change', (e) => {
  if (e.target.id !== 'restore-file') return;
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((text) => confirmSheet('Restore this backup?', 'Everything in the app now will be replaced by the backup.', 'Restore', () => {
    if (R.importJson(text)) { ui.stack = [{ r: 'home' }]; toast('Backup restored'); render(); } else toast("That file isn't a Pocketta backup");
  }));
  e.target.value = '';
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT') return; // checkboxes handled on change
  e.stopPropagation();
  actions[el.dataset.act]?.(el, e);
});
document.addEventListener('change', (e) => { if (e.target.dataset?.act === 'toggle-alert') actions['toggle-alert'](e.target); });

document.addEventListener('input', async (e) => {
  if (e.target.id !== 'pin') return;
  const v = e.target.value;
  const s = R.S();
  if (v.length < 4) return;
  if ((await hashPin(v, s.pinSalt)) === s.pinHash) { ui.locked = false; render(); }
  else if (v.length >= 8) { e.target.value = ''; $('#pin-msg').textContent = 'Wrong PIN'; }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ui.hiddenAt = Date.now(); return; }
  if (R.S().pinHash && ui.hiddenAt && Date.now() - ui.hiddenAt > 60000) { ui.locked = true; document.querySelectorAll('.scrim').forEach((x) => x.remove()); }
  R.ensureSalary();
  render();
});
window.addEventListener('popstate', () => { if (ui.stack.length > 1) back(); });

// Re-render on data changes, except while typing on the Add page.
R.onChange(() => { if (cur().r !== 'add') render(); });

(async function main() {
  await R.load();
  ui.locked = !!R.S().pinHash;
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
