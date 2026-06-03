/* ============================================================
   Tallo CPA – BIR Tax App for Manager.io
   app.js  –  Core: postMessage bridge, business selector, routing
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────
const App = {
  businesses: [],
  currentBusiness: null,
  currentPage: 'dashboard',
  currentParams: {},
};

// ── POST-MESSAGE BRIDGE ──────────────────────────────────────
async function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('API request timed out'));
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

// ── FETCH ALL (handles 50-item pagination) ───────────────────
async function fetchAllBatch(batchPath, businessName) {
  const all = [];
  let skip = 0;
  const PAGE = 50;
  while (true) {
    const qs = new URLSearchParams({
      Business: businessName,
      Skip: String(skip),
      PageSize: String(PAGE),
    }).toString();
    const res = await apiRequest('GET', `${batchPath}?${qs}`);
    const items = res?.items || [];
    all.push(...items);
    if (items.length < PAGE) break;
    skip += PAGE;
  }
  return all;  // [{key, item}]
}

// ── BUSINESSES ───────────────────────────────────────────────
async function loadBusinesses() {
  try {
    const res = await apiRequest('GET', '/api4/businesses');
    App.businesses = res?.businesses || [];

    const sel = document.getElementById('business-select');
    if (!sel) return;

    sel.innerHTML = App.businesses.length === 0
      ? '<option value="">No businesses found</option>'
      : App.businesses.map(b =>
          `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`
        ).join('');

    // Restore last selected
    const last = localStorage.getItem('tallocpa_last_business');
    if (last && App.businesses.find(b => b.name === last)) {
      sel.value = last;
    }

    App.currentBusiness = sel.value || (App.businesses[0]?.name ?? null);
    sel.value = App.currentBusiness;

    sel.addEventListener('change', () => {
      App.currentBusiness = sel.value;
      localStorage.setItem('tallocpa_last_business', sel.value);
      renderContent();
      updateNavVisibility();
    });

    updateNavVisibility();
  } catch (e) {
    console.error('Failed to load businesses', e);
    const sel = document.getElementById('business-select');
    if (sel) sel.innerHTML = '<option value="">⚠ Could not load</option>';
  }
}

// ── SETUP HELPERS ────────────────────────────────────────────
function getSetup(businessName) {
  try {
    const raw = localStorage.getItem(`tallocpa_setup_${businessName}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSetup(businessName, data) {
  localStorage.setItem(`tallocpa_setup_${businessName}`, JSON.stringify(data));
}

function getCustomers(businessName) {
  try {
    const raw = localStorage.getItem(`tallocpa_customers_${businessName}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomers(businessName, data) {
  localStorage.setItem(`tallocpa_customers_${businessName}`, JSON.stringify(data));
}

function getSuppliers(businessName) {
  try {
    const raw = localStorage.getItem(`tallocpa_suppliers_${businessName}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSuppliers(businessName, data) {
  localStorage.setItem(`tallocpa_suppliers_${businessName}`, JSON.stringify(data));
}

// ── NAV VISIBILITY (based on setup) ──────────────────────────
function updateNavVisibility() {
  const setup = App.currentBusiness ? getSetup(App.currentBusiness) : null;
  const wt = setup?.withholdingTypes || [];
  const st = setup?.salesTaxType || 'none';
  const cl = setup?.classification || 'Non-Individual';

  // VAT items
  document.querySelectorAll('[data-req="vat"]').forEach(el => {
    el.classList.toggle('disabled', st !== 'vat');
  });
  // PT items
  document.querySelectorAll('[data-req="pt"]').forEach(el => {
    el.classList.toggle('disabled', st !== 'pt');
  });
  // Compensation WT
  document.querySelectorAll('[data-req="compensation"]').forEach(el => {
    el.classList.toggle('disabled', !wt.includes('compensation'));
  });
  // Expanded WT
  document.querySelectorAll('[data-req="expanded"]').forEach(el => {
    el.classList.toggle('disabled', !wt.includes('expanded'));
  });
  // Individual-only
  document.querySelectorAll('[data-req="individual"]').forEach(el => {
    el.classList.toggle('disabled', cl !== 'Individual');
  });
  // Non-individual-only
  document.querySelectorAll('[data-req="nonindividual"]').forEach(el => {
    el.classList.toggle('disabled', cl !== 'Non-Individual');
  });
  // SLS/SLP (VAT or PT)
  document.querySelectorAll('[data-req="vatpt"]').forEach(el => {
    el.classList.toggle('disabled', st === 'none');
  });
}

// ── ROUTING ──────────────────────────────────────────────────
function navigate(page, params = {}) {
  App.currentPage = page;
  App.currentParams = params;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  renderContent();
}

function renderContent() {
  const el = document.getElementById('content');
  if (!el) return;

  if (!App.currentBusiness) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon">🏢</div>
      <h3>No Business Selected</h3>
      <p>Please select a business from the dropdown above.</p>
    </div>`;
    return;
  }

  const page = App.currentPage;

  if (page === 'dashboard')   return renderDashboard(el);
  if (page === 'setup')       return renderSetup(el);
  if (page === 'sls')         return renderSLS(el);
  if (page === 'slp')         return renderSLP(el);
  if (page === 'vat-monthly') return renderVATReturn(el, 'monthly');
  if (page === 'vat-quarterly') return renderVATReturn(el, 'quarterly');

  // Coming soon pages
  el.innerHTML = comingSoon(page);
}

function comingSoon(page) {
  const labels = {
    'ewt-monthly': 'EWT Monthly (0619E)',
    'ewt-quarterly': 'EWT Quarterly (1601EQ)',
    '1601c': 'Withholding Tax on Compensation (1601C)',
    '2551m': 'Percentage Tax Monthly (2551M)',
    '2551q': 'Percentage Tax Quarterly (2551Q)',
    '1702q': 'Quarterly Income Tax (1702Q)',
    '1702rt': 'Annual Income Tax (1702RT)',
    '1701q': 'Quarterly Income Tax (1701Q)',
    '1701': 'Annual Income Tax (1701)',
    '1604c': 'Annual Alphalist — Compensation (1604C)',
    '1604e': 'Annual Alphalist — EWT (1604E)',
    'qap': 'Quarterly Alphalist of Payees (QAP)',
    'sawt': 'Summary Alphalist of Withholding Taxes (SAWT)',
    '2307': 'Generate BIR Form 2307',
    '2316': 'Generate BIR Form 2316',
    'sss-phic-hdmf': 'SSS / PhilHealth / Pag-IBIG Remittance',
  };
  const label = labels[page] || page;
  return `<div class="coming-soon">
    <div class="cs-icon">🚧</div>
    <h2>${escHtml(label)}</h2>
    <p>This module is part of the next phase and will be available soon.</p>
    <span class="cs-badge">PHASE 2</span>
  </div>`;
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard(el) {
  const setup = getSetup(App.currentBusiness);
  const wt = setup?.withholdingTypes || [];
  const st = setup?.salesTaxType || 'none';
  const cl = setup?.classification || 'Non-Individual';

  const now = new Date();
  const month = now.toLocaleString('en-PH', { month: 'long' });
  const year = now.getFullYear();

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">${escHtml(App.currentBusiness)} &mdash; ${month} ${year}</div>
      </div>
    </div>

    ${!setup ? `<div class="setup-required">
      <span>⚠️</span>
      <div><strong>Setup Required</strong> — Please configure this business before generating returns.</div>
      <button class="btn btn-primary btn-sm" onclick="navigate('setup')">Go to Setup</button>
    </div>` : ''}

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Taxpayer</div>
        <div class="stat-value small">${escHtml(setup?.taxpayerName || '—')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TIN</div>
        <div class="stat-value small">${escHtml(setup?.tin || '—')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">RDO Code</div>
        <div class="stat-value">${escHtml(setup?.rdoCode || '—')}</div>
      </div>
      <div class="stat-card ${st === 'vat' ? '' : 'red'}">
        <div class="stat-label">Sales Tax</div>
        <div class="stat-value small">${st === 'vat' ? 'VAT' : st === 'pt' ? 'Percentage Tax' : 'None'}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📋 Quick Access — Returns</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
        ${quickBtn('VAT Monthly (2550M)', 'vat-monthly', st === 'vat')}
        ${quickBtn('VAT Quarterly (2550Q)', 'vat-quarterly', st === 'vat')}
        ${quickBtn('EWT Monthly (0619E)', 'ewt-monthly', wt.includes('expanded'))}
        ${quickBtn('EWT Quarterly (1601EQ)', 'ewt-quarterly', wt.includes('expanded'))}
        ${quickBtn('WTC Monthly (1601C)', '1601c', wt.includes('compensation'))}
        ${cl === 'Individual'
          ? quickBtn('Income Tax Qtrly (1701Q)', '1701q', true) + quickBtn('Income Tax Annual (1701)', '1701', true)
          : quickBtn('Income Tax Qtrly (1702Q)', '1702q', true) + quickBtn('Income Tax Annual (1702RT)', '1702rt', true)}
      </div>
    </div>

    <div class="card">
      <div class="card-title">📊 Quick Access — Reports</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
        ${quickBtn('Summary List of Sales', 'sls', st !== 'none')}
        ${quickBtn('Summary List of Purchases', 'slp', st !== 'none')}
        ${quickBtn('QAP', 'qap', wt.includes('expanded'))}
        ${quickBtn('SAWT', 'sawt', true)}
      </div>
    </div>

    <div class="card">
      <div class="card-title">📄 Quick Access — Certificates</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
        ${quickBtn('Generate Form 2307', '2307', wt.includes('expanded'))}
        ${quickBtn('Generate Form 2316', '2316', wt.includes('compensation'))}
        ${quickBtn('SSS/PhilHealth/Pag-IBIG', 'sss-phic-hdmf', wt.includes('compensation'))}
      </div>
    </div>
  `;
}

function quickBtn(label, page, enabled) {
  if (enabled) {
    return `<button class="btn btn-outline" style="justify-content:flex-start;font-size:11px;padding:8px 10px;"
      onclick="navigate('${page}')">${escHtml(label)}</button>`;
  }
  return `<button class="btn btn-outline" style="justify-content:flex-start;font-size:11px;padding:8px 10px;opacity:0.4;cursor:not-allowed;" disabled>${escHtml(label)}</button>`;
}

// ── UTILITY ──────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

function monthName(m) {  // m = 0-based
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][m] || '';
}

function quarterLabel(q) { // q = 1-4
  return `Q${q} (${[['Jan','Mar'],['Apr','Jun'],['Jul','Sep'],['Oct','Dec']][q-1].join('–')})`;
}

// Period start/end dates
function getPeriodDates(type, period, year) {
  if (type === 'monthly') {
    const m = parseInt(period, 10);  // 0-based
    const start = new Date(year, m, 1);
    const end   = new Date(year, m + 1, 0);
    return { start, end };
  }
  if (type === 'quarterly') {
    const q = parseInt(period, 10);  // 1-based
    const startM = (q - 1) * 3;
    const start  = new Date(year, startM, 1);
    const end    = new Date(year, startM + 3, 0);
    return { start, end };
  }
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadBusinesses();
  navigate('dashboard');
});
