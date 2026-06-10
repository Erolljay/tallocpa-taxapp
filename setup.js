/* ============================================================
   Tallo CPA – BIR Tax App
   setup.js  –  Setup: Business Info, Packages, VAT Mapping,
                Customers, Suppliers
   ============================================================ */

const BASE_URL = 'https://erolljay.github.io/tallocpa-taxapp';

const PACKAGES = [
  { id: 'pkg-2550q', name: '2550Q Quarterly VAT Return', file: '2550q.html', uuid: 'b2c3d4e5-f6a7-4890-b123-c4d5e6f7a8b9', phase: 1, req: 'vat' },
  { id: 'pkg-sls',   name: 'Summary List of Sales (SLS)', file: 'sls.html',  uuid: 'c3d4e5f6-a7b8-4901-c234-d5e6f7a8b9c0', phase: 1, req: 'vat' },
  { id: 'pkg-slp',   name: 'Summary List of Purchases (SLP)', file: 'slp.html', uuid: 'd4e5f6a7-b8c9-4012-d345-e6f7a8b9c0d1', phase: 1, req: 'vat' },
  { id: 'pkg-qap',   name: 'QAP – Quarterly Alphalist of Payees', file: 'qap.html', uuid: 'e5f6a7b8-c9d0-4123-e456-f7a8b9c0d1e2', phase: 2, req: 'expanded' },
  { id: 'pkg-sawt',  name: 'SAWT – Summary Alphalist of Withholding Taxes', file: 'sawt.html', uuid: 'f6a7b8c9-d0e1-4234-f567-a8b9c0d1e2f3', phase: 2, req: 'expanded' },
  { id: 'pkg-2307',  name: 'Generate BIR Form 2307', file: '2307.html',    uuid: 'a7b8c9d0-e1f2-4345-a678-b9c0d1e2f3a4', phase: 2, req: 'expanded' },
  { id: 'pkg-2316',  name: 'Generate BIR Form 2316', file: '2316.html',    uuid: 'b8c9d0e1-f2a3-4456-b789-c0d1e2f3a4b5', phase: 2, req: 'compensation' },
  { id: 'pkg-sss',   name: 'SSS / PhilHealth / Pag-IBIG Remittance', file: 'sss.html', uuid: 'c9d0e1f2-a3b4-4567-c890-d1e2f3a4b5c6', phase: 2, req: 'compensation' },
];

const VAT_CATEGORIES = [
  { key: 'sales_taxable',  label: 'Taxable Sales (12%)',       side: 'sales',    defaultName: 'Sales - Output VAT 12%',    rate: 0.12 },
  { key: 'sales_zero',     label: 'Zero-Rated Sales',          side: 'sales',    defaultName: 'Sales - Zero-Rated',        rate: 0    },
  { key: 'sales_exempt',   label: 'VAT Exempt Sales',          side: 'sales',    defaultName: 'Sales - VAT Exempt',        rate: 0    },
  { key: 'purch_capital',  label: 'Input VAT – Capital Goods', side: 'purchase', defaultName: 'Input VAT 12% (Capital Goods)', rate: 0.12 },
  { key: 'purch_other',    label: 'Input VAT – Other Goods',   side: 'purchase', defaultName: 'Input VAT 12% (Other Goods)',   rate: 0.12 },
  { key: 'purch_services', label: 'Input VAT – Services',      side: 'purchase', defaultName: 'Input VAT 12% (Services)',      rate: 0.12 },
  { key: 'purch_zero',     label: 'Zero-Rated Purchases',      side: 'purchase', defaultName: 'Zero-Rated Purchases',      rate: 0    },
  { key: 'purch_exempt',   label: 'Exempt Purchases',          side: 'purchase', defaultName: 'Purchase - VAT Exempt',     rate: 0    },
  { key: 'govt_wv012',     label: 'Govt Withholding VAT – Goods (5%)',    side: 'sales', defaultName: 'WV012 – Govt WHT VAT Goods (5%)',    rate: 0.05 },
  { key: 'govt_wv022',     label: 'Govt Withholding VAT – Services (5%)', side: 'sales', defaultName: 'WV022 – Govt WHT VAT Services (5%)', rate: 0.05 },
];

let _taxCodes = [];

// ── MAIN RENDER ──────────────────────────────────────────────
function renderSetup(el) {
  const setup = getSetup(App.currentBusiness) || {};
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">⚙️ Business Setup</div>
        <div class="page-subtitle">${escHtml(App.currentBusiness)}</div>
      </div>
    </div>
    <div class="tab-bar" id="setup-tabs">
      <button class="tab-btn active"  data-tab="info">📋 Business Info</button>
      <button class="tab-btn"         data-tab="pkgs">📦 Install Packages</button>
      <button class="tab-btn"         data-tab="vat">🗂 VAT Mapping</button>
      <button class="tab-btn"         data-tab="customers">👤 Customers</button>
      <button class="tab-btn"         data-tab="suppliers">🏭 Suppliers</button>
    </div>
    <div id="tab-info"      class="tab-panel active">${renderBusinessInfoTab(setup)}</div>
    <div id="tab-pkgs"      class="tab-panel">${renderPackagesTab(setup)}</div>
    <div id="tab-vat"       class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading…</span></div></div>
    <div id="tab-customers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading…</span></div></div>
    <div id="tab-suppliers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading…</span></div></div>
  `;

  document.getElementById('setup-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
    if (tab === 'pkgs')      reRenderPackagesTab();
    if (tab === 'vat')       loadVATMappingTab();
    if (tab === 'customers') loadPartyTab('customers');
    if (tab === 'suppliers') loadPartyTab('suppliers');
  });

  document.getElementById('business-info-form')?.addEventListener('submit', saveBusinessInfo);
  document.getElementById('si-classification')?.addEventListener('change', toggleNameFields);
  toggleNameFields();
}

// ── TAB: BUSINESS INFO ────────────────────────────────────────
function renderBusinessInfoTab(setup) {
  const wt  = setup.withholdingTypes || [];
  const cls = setup.classification || 'Non-Individual';
  const isInd = cls === 'Individual';

  return `<form id="business-info-form">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="card-title">Taxpayer Details</div>
        <div class="form-grid">

          <!-- Non-Individual name -->
          <div class="form-group full" id="grp-company" style="display:${isInd?'none':''};">
            <label class="form-label">Company / Registered Name</label>
            <input class="form-input" id="si-company" placeholder="ABC Corporation"
              value="${escHtml(setup.companyName||setup.taxpayerName||'')}">
          </div>

          <!-- Individual name fields -->
          <div class="form-group" id="grp-ln" style="display:${isInd?'':'none'};">
            <label class="form-label">Last Name</label>
            <input class="form-input" id="si-ln" placeholder="Dela Cruz" value="${escHtml(setup.lastName||'')}">
          </div>
          <div class="form-group" id="grp-fn" style="display:${isInd?'':'none'};">
            <label class="form-label">First Name</label>
            <input class="form-input" id="si-fn" placeholder="Juan" value="${escHtml(setup.firstName||'')}">
          </div>
          <div class="form-group" id="grp-mn" style="display:${isInd?'':'none'};">
            <label class="form-label">Middle Name</label>
            <input class="form-input" id="si-mn" placeholder="Santos" value="${escHtml(setup.middleName||'')}">
          </div>

          <div class="form-group full">
            <label class="form-label">TIN (000-000-000-000)</label>
            <input class="form-input" id="si-tin" placeholder="000-000-000-000" value="${escHtml(setup.tin||'')}">
          </div>
          <div class="form-group full">
            <label class="form-label">Registered Address</label>
            <textarea class="form-textarea" id="si-address" placeholder="Unit/Floor, Building, Street, Barangay">${escHtml(setup.address||'')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Zip Code</label>
            <input class="form-input" id="si-zip" placeholder="e.g., 5000" value="${escHtml(setup.zipCode||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">RDO Code</label>
            <input class="form-input" id="si-rdo" placeholder="e.g., 083" value="${escHtml(setup.rdoCode||'')}">
          </div>
        </div>
      </div>

      <div>
        <div class="card-title">Filing Information</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Taxpayer Classification</label>
            <select class="form-select" id="si-classification">
              <option value="Non-Individual" ${cls==='Non-Individual'?'selected':''}>Non-Individual / Corporation</option>
              <option value="Individual"     ${cls==='Individual'?'selected':''}>Individual</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Industry Classification</label>
            <input class="form-input" id="si-industry" placeholder="e.g., Retail Trade"
              value="${escHtml(setup.industryClassification||'')}">
          </div>
          <div class="form-group full" id="income-tax-row" style="display:${isInd?'':'none'};">
            <label class="form-label">Income Tax Type</label>
            <div class="radio-group">
              <label><input type="radio" name="incomeTaxType" value="8flat"
                ${setup.incomeTaxType==='8flat'?'checked':''}> 8% Flat Rate</label>
              <label><input type="radio" name="incomeTaxType" value="graduated"
                ${setup.incomeTaxType!=='8flat'?'checked':''}> Graduated Rates (1701Q / 1701)</label>
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label">Sales Tax Type</label>
            <div class="radio-group">
              <label><input type="radio" name="salesTaxType" value="vat"
                ${setup.salesTaxType==='vat'?'checked':''}> Value Added Tax (2550Q)</label>
              <label><input type="radio" name="salesTaxType" value="pt"
                ${setup.salesTaxType==='pt'?'checked':''}> Percentage Tax (2551Q)</label>
              <label><input type="radio" name="salesTaxType" value="none"
                ${(!setup.salesTaxType||setup.salesTaxType==='none')?'checked':''}> None Applicable</label>
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label">Withholding Tax Types</label>
            <div class="check-group">
              <label><input type="checkbox" name="wtType" value="compensation"
                ${wt.includes('compensation')?'checked':''}> Compensation (1601C)</label>
              <label><input type="checkbox" name="wtType" value="expanded"
                ${wt.includes('expanded')?'checked':''}> Expanded (1601EQ / 0619E)</label>
              <label><input type="checkbox" name="wtType" value="final"
                ${wt.includes('final')?'checked':''}> Final (1601FQ / 0619F)</label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <button type="submit" class="btn btn-primary">💾 Save Business Info</button>
    </div>
  </form>`;
}

function toggleNameFields() {
  const cls   = document.getElementById('si-classification')?.value || 'Non-Individual';
  const isInd = cls === 'Individual';
  const show  = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis ? '' : 'none'; };
  show('grp-company', !isInd);
  show('grp-ln',  isInd); show('grp-fn', isInd); show('grp-mn', isInd);
  show('income-tax-row', isInd);
}

function saveBusinessInfo(e) {
  e.preventDefault();
  const cls   = document.getElementById('si-classification').value;
  const isInd = cls === 'Individual';
  const existing = getSetup(App.currentBusiness) || {};
  const wt = [...document.querySelectorAll('input[name=wtType]:checked')].map(i => i.value);

  const companyName = isInd ? '' : (document.getElementById('si-company')?.value.trim() || '');
  const lastName    = isInd ? (document.getElementById('si-ln')?.value.trim() || '') : '';
  const firstName   = isInd ? (document.getElementById('si-fn')?.value.trim() || '') : '';
  const middleName  = isInd ? (document.getElementById('si-mn')?.value.trim() || '') : '';

  // taxpayerName for display/print
  const taxpayerName = isInd
    ? [lastName, firstName, middleName].filter(Boolean).join(', ')
    : companyName;

  const updatedSetup = {
    ...existing,
    taxpayerName, companyName, lastName, firstName, middleName,
    tin:         document.getElementById('si-tin').value.trim(),
    address:     document.getElementById('si-address').value.trim(),
    zipCode:     document.getElementById('si-zip').value.trim(),
    rdoCode:     document.getElementById('si-rdo').value.trim(),
    classification: cls,
    industryClassification: document.getElementById('si-industry').value.trim(),
    incomeTaxType: document.querySelector('input[name=incomeTaxType]:checked')?.value || 'graduated',
    salesTaxType:  document.querySelector('input[name=salesTaxType]:checked')?.value || 'none',
    withholdingTypes: wt,
  };
  saveSetup(App.currentBusiness, updatedSetup);
  showToast('✅ Business info saved.', 'success');
  // Re-render packages tab so it reflects the new tax types immediately
  reRenderPackagesTab();
}



// ── TAB: PACKAGES ─────────────────────────────────────────────
function renderPackagesTab(setup) {
  const st = setup.salesTaxType || 'none';
  const wt = setup.withholdingTypes || [];
  const installed = setup.installedPackages || [];

  const isAvailable = pkg => {
    if (pkg.req === 'vat')          return st === 'vat';
    if (pkg.req === 'pt')           return st === 'pt';
    if (pkg.req === 'expanded')     return wt.includes('expanded');
    if (pkg.req === 'compensation') return wt.includes('compensation');
    return true;
  };

  return `
    <div class="alert alert-info" style="margin-bottom:14px;">
      ℹ️ Install each report as a <strong>Custom Button</strong> under Reports in Manager.
      Available packages are based on your configured tax types.
      After installing, refresh Manager to see the new buttons under <strong>Reports → Custom Buttons</strong>.
    </div>

    ${setup.salesTaxType ? '' : `<div class="alert alert-warn" style="margin-bottom:14px;">
      ⚠️ Please complete <strong>Business Info</strong> first to see available packages.
    </div>`}

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${PACKAGES.map(pkg => {
        const avail   = isAvailable(pkg);
        const isInst  = installed.includes(pkg.id);
        const isPhase2 = pkg.phase === 2;
        const url     = `${BASE_URL}/${pkg.file}`;
        return `
          <div class="card" style="margin:0;padding:14px 16px;display:flex;align-items:center;gap:14px;
            ${!avail ? 'opacity:0.45;' : ''}">
            <div style="font-size:22px;">${isInst ? '✅' : isPhase2 ? '🔜' : '📋'}</div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:13px;color:#0d1b3e;">${escHtml(pkg.name)}</div>
              <div style="font-size:10px;color:#6b7280;margin-top:2px;">
                ${isPhase2 ? '<span style="background:#e8edf5;color:#6b7280;padding:1px 6px;border-radius:3px;font-size:9px;">PHASE 2</span>' : ''}
                ${!avail ? '<span style="background:#fef2f2;color:#991b1b;padding:1px 6px;border-radius:3px;font-size:9px;">Requires different tax type</span>' : ''}
                ${isInst ? '<span style="background:#f0fdf4;color:#15803d;padding:1px 6px;border-radius:3px;font-size:9px;">INSTALLED</span>' : ''}
              </div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px;font-family:monospace;">${url}</div>
            </div>
            ${avail && !isPhase2 ? `
              <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn btn-outline btn-sm" onclick="copyURL('${url}')">📋 Copy URL</button>
                <button class="btn btn-primary btn-sm" id="install-${pkg.id}"
                  onclick="installPackage('${pkg.id}','${escHtml(pkg.name)}','${url}','${pkg.uuid}')">
                  ${isInst ? '🔄 Reinstall' : '⚡ Install'}
                </button>
              </div>` : isPhase2 ? `
              <span style="font-size:10px;color:#94a3b8;flex-shrink:0;">Coming soon</span>` : ''}
          </div>`;
      }).join('')}
    </div>

    <div class="alert alert-info" style="margin-top:16px;font-size:11px;">
      💡 <strong>How to install manually:</strong> Copy URL → Manager → Settings → Custom Buttons → New →
      paste URL → set location to <strong>Report view</strong> → Save.
    </div>`;
}

function reRenderPackagesTab() {
  const setup = getSetup(App.currentBusiness) || {};
  const panel = document.getElementById('tab-pkgs');
  if (panel) panel.innerHTML = renderPackagesTab(setup);
}

function copyURL(url) {
  navigator.clipboard?.writeText(url).then(() => showToast('✅ URL copied to clipboard.', 'success'))
    .catch(() => showToast('Copy: ' + url));
}

async function installPackage(pkgId, name, url, uuid) {
  const btn = document.getElementById(`install-${pkgId}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  try {
    // PUT /api4/custom-button-form/{key} — fields go directly, no value:{} wrapper
    await apiRequest('PUT', `/api4/custom-button-form/${uuid}`, {
      Name:     name,
      Source:   1,
      Endpoint: url,
    });
    // Mark as installed in local setup
    const existing = getSetup(App.currentBusiness) || {};
    const inst = existing.installedPackages || [];
    if (!inst.includes(pkgId)) inst.push(pkgId);
    saveSetup(App.currentBusiness, { ...existing, installedPackages: inst });
    showToast(`✅ "${name}" installed. Refresh Manager to see it under Reports → Custom Buttons.`, 'success');
    if (btn) { btn.textContent = '🔄 Reinstall'; btn.disabled = false; }
    reRenderPackagesTab();
  } catch (err) {
    // Fallback: copy URL to clipboard
    navigator.clipboard?.writeText(url);
    showToast(`⚠️ Install failed (${err.message}). URL copied — paste manually in Settings → Custom Buttons.`, 'err');
    if (btn) { btn.textContent = '⚡ Install'; btn.disabled = false; }
  }
}

// ── TAB: VAT MAPPING ─────────────────────────────────────────
async function fetchTaxCodes(businessName) {
  const all = [];
  let skip = 0;
  while (true) {
    const qs  = new URLSearchParams({ business: businessName, pageSize: '50', skip: String(skip) }).toString();
    const res = await apiRequest('GET', `/tax-codes?${qs}`);
    const page = Array.isArray(res) ? res : (res?.items || res || []);
    if (!Array.isArray(page) || !page.length) break;
    all.push(...page);
    if (page.length < 50) break;
    skip += 50;
  }
  return all; // Each item: { key, Name, ... }
}

async function loadVATMappingTab() {
  const panel = document.getElementById('tab-vat');
  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Fetching tax codes from Manager…</span></div>`;
  try {
    const items = await fetchTaxCodes(App.currentBusiness);
    _taxCodes = items.map(row => ({
      key:  String(row.key || row.Key || ''),
      name: row.Name || row.name || row.key || '',
    }));
    const setup   = getSetup(App.currentBusiness) || {};
    const mapping = setup.vatMapping || {};

    panel.innerHTML = `
      <div class="alert alert-info" style="margin-bottom:14px;">
        ℹ️ Map each BIR VAT category to a tax code in Manager.
        Use <strong>Install</strong> to create a standard tax code if it doesn't exist yet.
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#0d1b3e;color:white;">
              <th style="padding:10px 14px;font-size:11px;width:30%;">BIR Category</th>
              <th style="padding:10px 14px;font-size:11px;">Tax Code in Manager (${_taxCodes.length} found)</th>
              <th style="padding:10px 14px;font-size:11px;width:110px;"></th>
            </tr>
          </thead>
          <tbody id="vat-map-body">
            ${VAT_CATEGORIES.map(cat => vatMapRow(cat, mapping[cat.key] || '')).join('')}
          </tbody>
        </table>
      </div>

      <!-- CWT Accounts -->
      <div class="card" style="margin-top:14px;">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>Creditable Withholding Tax Accounts <small style="font-weight:400;color:#6b7280;">(for SAWT / Schedule 3)</small></span>
          <button type="button" class="btn btn-outline btn-sm" onclick="addCwtRow()">+ Add</button>
        </div>
        <div class="alert alert-info" style="margin-bottom:12px;font-size:11px;">
          These are account names for CWT received from customers (negative line items on receipts/sales invoices).
        </div>
        <table class="data-table">
          <thead><tr><th>Account Name in Manager</th><th>Type</th><th style="width:40px;"></th></tr></thead>
          <tbody id="cwt-tbody">
            ${(mapping.cwtAccounts||[]).map((r,i) => cwtRow(r,i)).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" onclick="saveVATMapping()">💾 Save Mapping</button>
      </div>`;
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function vatMapRow(cat, selectedKey) {
  const opts = _taxCodes.map(tc =>
    `<option value="${escHtml(tc.key)}" ${tc.key===selectedKey?'selected':''}>${escHtml(tc.name)}</option>`
  ).join('');
  const badge = cat.side === 'sales'
    ? `<span style="font-size:9px;background:#27ae60;color:white;padding:1px 5px;border-radius:3px;">Sales</span>`
    : `<span style="font-size:9px;background:#2980b9;color:white;padding:1px 5px;border-radius:3px;">Purchase</span>`;
  return `<tr style="border-bottom:1px solid #f0f0f0;">
    <td style="padding:9px 14px;font-size:12px;font-weight:600;color:#0d1b3e;">${escHtml(cat.label)} ${badge}</td>
    <td style="padding:6px 14px;">
      <select class="form-select vm-sel" data-key="${cat.key}" style="width:100%;">
        <option value="">— Not mapped —</option>${opts}
      </select>
    </td>
    <td style="padding:6px 10px;">
      <button class="btn btn-outline btn-sm"
        onclick="installTaxCode('${cat.key}','${escHtml(cat.defaultName)}',${cat.rate},'${cat.side}')">✦ Install</button>
    </td>
  </tr>`;
}

async function installTaxCode(catKey, name, rate, side) {
  const btn = event.target; btn.disabled=true; btn.textContent='⏳…';
  try {
    const newKey = crypto.randomUUID();
    await apiRequest('PUT', '/api4/tax-code', {
      key: newKey,
      value: { Name: name, Rate: rate },
      business: App.currentBusiness,
    });
    const items = await fetchTaxCodes(App.currentBusiness);
    _taxCodes = items.map(r => ({ key: String(r.key||r.Key||''), name: r.Name||r.name||r.key||'' }));
    const sel = document.querySelector(`.vm-sel[data-key="${catKey}"]`);
    if (sel) {
      const opts = _taxCodes.map(tc =>
        `<option value="${escHtml(tc.key)}" ${tc.key===newKey?'selected':''}>${escHtml(tc.name)}</option>`
      ).join('');
      sel.innerHTML = `<option value="">— Not mapped —</option>${opts}`;
      sel.value = newKey;
    }
    showToast(`✅ "${name}" installed.`, 'success');
  } catch (err) { showToast(`❌ ${err.message}`, 'err'); }
  btn.disabled=false; btn.textContent='✦ Install';
}

function cwtRow(row = {}, i) {
  return `<tr data-cwt-row="${i}">
    <td><input class="form-input cwt-account" placeholder="e.g., Creditable Withholding Tax"
      value="${escHtml(row.accountName||'')}"></td>
    <td><select class="form-select cwt-type">
      <option value="2307" ${row.type==='2307'?'selected':''}>2307 — CWT from customers</option>
      <option value="5pct-wv" ${row.type==='5pct-wv'?'selected':''}>5% Withholding VAT (Govt clients)</option>
    </select></td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">✕</button></td>
  </tr>`;
}

function addCwtRow() {
  const tbody = document.getElementById('cwt-tbody');
  tbody.insertAdjacentHTML('beforeend', cwtRow({}, tbody.querySelectorAll('tr').length));
}

function saveVATMapping() {
  const existing = getSetup(App.currentBusiness) || {};
  const mapping  = {};
  document.querySelectorAll('.vm-sel').forEach(sel => { mapping[sel.dataset.key] = sel.value; });
  const cwt = [...document.querySelectorAll('#cwt-tbody tr')].map(tr => ({
    accountName: tr.querySelector('.cwt-account')?.value.trim() || '',
    type: tr.querySelector('.cwt-type')?.value || '2307',
  })).filter(r => r.accountName);
  mapping.cwtAccounts = cwt;
  saveSetup(App.currentBusiness, { ...existing, vatMapping: mapping });
  showToast('✅ VAT mapping saved.', 'success');
}

// ── FETCH PARTY LIST (uses list endpoint — returns Name directly) ──
async function fetchPartyList(type, businessName) {
  const endpoint = type === 'customers' ? 'customers' : 'suppliers';
  const all = [];
  let skip = 0;
  while (true) {
    const qs  = new URLSearchParams({ business: businessName, pageSize: '50', skip: String(skip) }).toString();
    const res = await apiRequest('GET', `/${endpoint}?${qs}`);
    const page = Array.isArray(res) ? res : (res?.items || res || []);
    if (!Array.isArray(page) || !page.length) break;
    all.push(...page);
    if (page.length < 50) break;
    skip += 50;
  }
  return all; // Each item: { key, Name, Code, ... } — Name is top-level
}

// ── TAB: CUSTOMERS / SUPPLIERS ────────────────────────────────
async function loadPartyTab(type) {
  const panel  = document.getElementById(`tab-${type}`);

  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading from Manager…</span></div>`;
  try {
    const items = await fetchPartyList(type, App.currentBusiness);
    const saved = type === 'customers' ? getCustomers(App.currentBusiness) : getSuppliers(App.currentBusiness);

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <input type="text" class="form-input" id="${type}-search" placeholder="Search…" style="width:200px;">
        <span style="font-size:11px;color:#6b7280;">${items.length} records — <strong>Save</strong> per row after editing.</span>
        <button class="btn btn-outline btn-sm" style="margin-left:auto;" onclick="saveAllParty('${type}')">💾 Save All</button>
      </div>
      <div class="data-table-wrap" style="overflow-x:auto;">
        <table class="data-table" id="${type}-table">
          <thead>
            <tr>
              <th>Name in Manager</th>
              <th>Type</th>
              <th>TIN</th>
              <th>Branch Code</th>
              <th class="corp-col">Company Name</th>
              <th class="ind-col">Last Name</th>
              <th class="ind-col">First Name</th>
              <th class="ind-col">MI</th>
              <th>Address 1</th>
              <th>Address 2</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map(row => {
              // List endpoint: Name is top-level (not nested inside item{})
              const key  = String(row.key || row.Key || '');
              const name = row.Name || row.name || row.DisplayName || key;
              const d    = saved[key] || {};
              const rowType = d.type || 'Non-Individual';
              const isInd   = rowType === 'Individual';
              return `<tr data-key="${escHtml(key)}" data-name="${escHtml(name)}">
                <td style="font-weight:600;min-width:140px;">${escHtml(name)}</td>
                <td>
                  <select class="form-select party-type" style="width:130px;" onchange="togglePartyRow(this)">
                    <option value="Non-Individual" ${!isInd?'selected':''}>Non-Individual</option>
                    <option value="Individual"     ${isInd?'selected':''}>Individual</option>
                  </select>
                </td>
                <td><input class="form-input pf-tin" style="width:120px;" placeholder="000-000-000-000" value="${escHtml(d.tin||'')}"></td>
                <td><input class="form-input pf-branchCode" style="width:70px;" placeholder="000" value="${escHtml(d.branchCode||'')}"></td>
                <td class="corp-col"><input class="form-input pf-companyName" style="width:140px;" placeholder="Corp/Company"
                  value="${escHtml(d.companyName||'')}" ${isInd?'disabled style="background:#f1f5f9;color:#94a3b8;"':''}></td>
                <td class="ind-col"><input class="form-input pf-lastName" style="width:100px;" placeholder="Last"
                  value="${escHtml(d.lastName||'')}" ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;"':''}></td>
                <td class="ind-col"><input class="form-input pf-firstName" style="width:90px;" placeholder="First"
                  value="${escHtml(d.firstName||'')}" ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;"':''}></td>
                <td class="ind-col"><input class="form-input pf-middleName" style="width:55px;" placeholder="MI"
                  value="${escHtml(d.middleName||'')}" ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;"':''}></td>
                <td><input class="form-input pf-address1" style="width:150px;" placeholder="Unit, Bldg, Street" value="${escHtml(d.address1||'')}"></td>
                <td><input class="form-input pf-address2" style="width:130px;" placeholder="City, Province" value="${escHtml(d.address2||'')}"></td>
                <td><button class="btn btn-primary btn-sm" onclick="savePartyRow(this,'${type}')">Save</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById(`${type}-search`).addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll(`#${type}-table tbody tr`).forEach(tr => {
        tr.style.display = (tr.dataset.name||'').toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function togglePartyRow(sel) {
  const tr    = sel.closest('tr');
  const isInd = sel.value === 'Individual';
  const dis   = (cls, disabled) => {
    tr.querySelectorAll(`.${cls}`).forEach(inp => {
      inp.disabled = disabled;
      inp.style.background = disabled ? '#f1f5f9' : '';
      inp.style.color      = disabled ? '#94a3b8' : '';
      if (disabled) inp.value = '';
    });
  };
  dis('pf-companyName', isInd);
  dis('pf-lastName',    !isInd);
  dis('pf-firstName',   !isInd);
  dis('pf-middleName',  !isInd);
}

function savePartyRow(btn, type) {
  const tr  = btn.closest('tr');
  const key = tr.dataset.key; if (!key) return;
  const saved = type === 'customers' ? getCustomers(App.currentBusiness) : getSuppliers(App.currentBusiness);
  saved[key] = {
    type:        tr.querySelector('.party-type')?.value || 'Non-Individual',
    tin:         tr.querySelector('.pf-tin')?.value.trim()         || '',
    branchCode:  tr.querySelector('.pf-branchCode')?.value.trim()  || '',
    companyName: tr.querySelector('.pf-companyName')?.value.trim() || '',
    lastName:    tr.querySelector('.pf-lastName')?.value.trim()    || '',
    firstName:   tr.querySelector('.pf-firstName')?.value.trim()   || '',
    middleName:  tr.querySelector('.pf-middleName')?.value.trim()  || '',
    address1:    tr.querySelector('.pf-address1')?.value.trim()    || '',
    address2:    tr.querySelector('.pf-address2')?.value.trim()    || '',
  };
  if (type === 'customers') saveCustomers(App.currentBusiness, saved);
  else                      saveSuppliers(App.currentBusiness, saved);
  btn.textContent = '✅'; btn.style.background = '#27ae60';
  setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; }, 1500);
}

function saveAllParty(type) {
  const saved = {};
  document.querySelectorAll(`#${type}-table tbody tr`).forEach(tr => {
    const key = tr.dataset.key; if (!key) return;
    saved[key] = {
      type:        tr.querySelector('.party-type')?.value        || 'Non-Individual',
      tin:         tr.querySelector('.pf-tin')?.value.trim()         || '',
      branchCode:  tr.querySelector('.pf-branchCode')?.value.trim()  || '',
      companyName: tr.querySelector('.pf-companyName')?.value.trim() || '',
      lastName:    tr.querySelector('.pf-lastName')?.value.trim()    || '',
      firstName:   tr.querySelector('.pf-firstName')?.value.trim()   || '',
      middleName:  tr.querySelector('.pf-middleName')?.value.trim()  || '',
      address1:    tr.querySelector('.pf-address1')?.value.trim()    || '',
      address2:    tr.querySelector('.pf-address2')?.value.trim()    || '',
    };
  });
  if (type === 'customers') saveCustomers(App.currentBusiness, saved);
  else                      saveSuppliers(App.currentBusiness, saved);
  showToast(`✅ All ${type} saved.`, 'success');
}
