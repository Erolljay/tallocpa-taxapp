/* ============================================================
   Tallo CPA – BIR Tax App
   shared.js  –  postMessage bridge, storage helpers, utilities
                 Used by ALL pages (Setup + Report extensions)
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────
const App = { businesses: [], currentBusiness: null };

// ── POST-MESSAGE BRIDGE ──────────────────────────────────────
async function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('API request timed out after 30s'));
    }, 30000);
    function handler(event) {
      const d = event.data;
      if (d?.type?.endsWith('-response') && d?.requestId === requestId) {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        if (d.error) reject(new Error(d.error));
        else resolve(d.body);
      }
    }
    window.addEventListener('message', handler);
    const msg = { type: 'api-request', method, path, requestId };
    if (body) msg.body = body;
    window.parent.postMessage(msg, '*');
  });
}

// ── FETCH ALL BATCH (50/page) ────────────────────────────────
async function fetchAllBatch(batchPath, businessName) {
  const all = [];
  let skip = 0;
  const PAGE = 50;
  while (true) {
    const qs = new URLSearchParams({ Business: businessName, Skip: String(skip), PageSize: String(PAGE) }).toString();
    const res = await apiRequest('GET', `${batchPath}?${qs}`);
    const items = res?.items || [];
    all.push(...items);
    if (items.length < PAGE) break;
    skip += PAGE;
  }
  return all;
}

// ── BUSINESSES ───────────────────────────────────────────────
async function loadBusinesses(selectId, onchange) {
  try {
    const res = await apiRequest('GET', '/api4/businesses');
    App.businesses = res?.businesses || [];
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = App.businesses.map(b =>
      `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`
    ).join('');
    const last = localStorage.getItem('tallocpa_last_business');
    if (last && App.businesses.find(b => b.name === last)) sel.value = last;
    App.currentBusiness = sel.value || App.businesses[0]?.name || '';
    sel.value = App.currentBusiness;
    sel.addEventListener('change', () => {
      App.currentBusiness = sel.value;
      localStorage.setItem('tallocpa_last_business', sel.value);
      if (onchange) onchange();
    });
    if (onchange && App.currentBusiness) onchange();
  } catch (e) {
    const sel = document.getElementById(selectId);
    if (sel) sel.innerHTML = '<option value="">⚠ Could not load</option>';
    console.error(e);
  }
}

// ── STORAGE HELPERS ──────────────────────────────────────────
function getSetup(biz)         { return tryParse(localStorage.getItem(`tallocpa_setup_${biz}`)); }
function saveSetup(biz, d)     { localStorage.setItem(`tallocpa_setup_${biz}`, JSON.stringify(d)); }
function getCustomers(biz)     { return tryParse(localStorage.getItem(`tallocpa_customers_${biz}`)) || {}; }
function saveCustomers(biz, d) { localStorage.setItem(`tallocpa_customers_${biz}`, JSON.stringify(d)); }
function getSuppliers(biz)     { return tryParse(localStorage.getItem(`tallocpa_suppliers_${biz}`)) || {}; }
function saveSuppliers(biz, d) { localStorage.setItem(`tallocpa_suppliers_${biz}`, JSON.stringify(d)); }

function tryParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

// ── UTILITIES ────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return s; }
}

function monthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m] || '';
}

function quarterLabel(q) {
  return `Q${q} (${[['Jan','Mar'],['Apr','Jun'],['Jul','Sep'],['Oct','Dec']][q-1].join('–')})`;
}

function getPeriodDates(type, period, year) {
  if (type === 'monthly') {
    const m = parseInt(period, 10);
    return { start: new Date(year, m, 1), end: new Date(year, m + 1, 0) };
  }
  const q = parseInt(period, 10);
  const sm = (q - 1) * 3;
  return { start: new Date(year, sm, 1), end: new Date(year, sm + 3, 0) };
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'ok') {
  let t = document.getElementById('__toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '__toast';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s;max-width:320px;';
    document.body.appendChild(t);
  }
  t.style.background = type === 'ok' ? '#1a2f5e' : type === 'err' ? '#c0392b' : '#27ae60';
  t.style.color = 'white';
  t.style.opacity = '1';
  t.textContent = msg;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── PERIOD FILTER HTML ────────────────────────────────────────
function periodFilterHTML(mode, idPrefix) {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear  = now.getFullYear();
  const curQ     = Math.ceil((curMonth + 1) / 3);
  const years    = [curYear - 2, curYear - 1, curYear, curYear + 1];

  const monthSel = `<select id="${idPrefix}-month">
    ${[0,1,2,3,4,5,6,7,8,9,10,11].map(m =>
      `<option value="${m}"${m===curMonth?' selected':''}>${monthName(m)}</option>`
    ).join('')}
  </select>`;

  const qSel = `<select id="${idPrefix}-quarter">
    ${[1,2,3,4].map(q =>
      `<option value="${q}"${q===curQ?' selected':''}>${quarterLabel(q)}</option>`
    ).join('')}
  </select>`;

  const yearSel = `<select id="${idPrefix}-year">
    ${years.map(y => `<option value="${y}"${y===curYear?' selected':''}>${y}</option>`).join('')}
  </select>`;

  const periodCtrl = mode === 'monthly'
    ? `<label>Month</label>${monthSel}`
    : `<label>Quarter</label>${qSel}`;

  return `<div class="filter-bar" id="${idPrefix}-filter">
    ${periodCtrl}
    <label>Year</label>${yearSel}
    <div class="filter-sep"></div>
    <button class="btn btn-primary" id="${idPrefix}-gen">⚡ Generate</button>
    <button class="btn btn-outline" id="${idPrefix}-print" style="display:none;" onclick="window.print()">🖨 Print</button>
    <button class="btn btn-success" id="${idPrefix}-pdf" style="display:none;" onclick="savePDF()">💾 Save PDF</button>
  </div>`;
}

function savePDF() {
  window.print();
}

// ── RETURN LINE ──────────────────────────────────────────────
function returnLine(num, label, amount, bold = false, cls = '') {
  return `<div class="return-line">
    <div class="return-line-num">${num}</div>
    <div class="return-line-label" style="${bold?'font-weight:700;':''}">${label}</div>
    <div class="return-line-amt ${cls}">₱ ${fmt(amount)}</div>
  </div>`;
}
