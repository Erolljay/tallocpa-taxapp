/* ============================================================
   Tallo CPA – BIR Tax App
   setup.js  –  Full Setup: Business Info, VAT Mapping, Customers, Suppliers
   ============================================================ */

const VAT_CATEGORIES = [
  { key: 'sales_taxable',   label: 'Taxable Sales (12%)',       side: 'sales',    defaultName: 'Sales - Output VAT 12%',      rate: 0.12 },
  { key: 'sales_zero',      label: 'Zero-Rated Sales',          side: 'sales',    defaultName: 'Sales - Zero-Rated',          rate: 0    },
  { key: 'sales_exempt',    label: 'VAT Exempt Sales',          side: 'sales',    defaultName: 'Sales - VAT Exempt',          rate: 0    },
  { key: 'purch_capital',   label: 'Input VAT – Capital Goods', side: 'purchase', defaultName: 'Input VAT - Capital Goods',   rate: 0.12 },
  { key: 'purch_other',     label: 'Input VAT – Other Goods',   side: 'purchase', defaultName: 'Input VAT - Other Goods',     rate: 0.12 },
  { key: 'purch_services',  label: 'Input VAT – Services',      side: 'purchase', defaultName: 'Input VAT - Services',        rate: 0.12 },
  { key: 'purch_zero',      label: 'Zero-Rated Purchases',      side: 'purchase', defaultName: 'Zero-Rated Purchases',        rate: 0    },
  { key: 'purch_exempt',    label: 'Exempt Purchases',          side: 'purchase', defaultName: 'Purchase - VAT Exempt',       rate: 0    },
];

let _taxCodes = [];  // cached tax codes for current business

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
      <button class="tab-btn active" data-tab="info">📋 Business Info</button>
      <button class="tab-btn" data-tab="vat">🗂 VAT Mapping</button>
      <button class="tab-btn" data-tab="customers">👤 Customers</button>
      <button class="tab-btn" data-tab="suppliers">🏭 Suppliers</button>
    </div>
    <div id="tab-info"      class="tab-panel active">${renderBusinessInfoTab(setup)}</div>
    <div id="tab-vat"       class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading tax codes…</span></div></div>
    <div id="tab-customers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading customers…</span></div></div>
    <div id="tab-suppliers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading suppliers…</span></div></div>
  `;

  document.getElementById('setup-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
    if (tab === 'vat')       loadVATMappingTab();
    if (tab === 'customers') loadPartyTab('customers');
    if (tab === 'suppliers') loadPartyTab('suppliers');
  });

  document.getElementById('business-info-form')?.addEventListener('submit', saveBusinessInfo);
  document.getElementById('si-classification')?.addEventListener('change', toggleIndividualFields);
  toggleIndividualFields();
}

// ── BUSINESS INFO TAB ─────────────────────────────────────────
function renderBusinessInfoTab(setup) {
  const wt = setup.withholdingTypes || [];
  return `<form id="business-info-form">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="card-title">Taxpayer Details</div>
        <div class="form-grid">
          <div class="form-group full">
            <label class="form-label">Taxpayer Name</label>
            <input class="form-input" id="si-name" placeholder="Juan Dela Cruz or ABC Corporation" value="${escHtml(setup.taxpayerName||'')}" required>
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
              <option value="Non-Individual" ${setup.classification==='Non-Individual'?'selected':''}>Non-Individual / Corporation</option>
              <option value="Individual" ${setup.classification==='Individual'?'selected':''}>Individual</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Industry Classification</label>
            <input class="form-input" id="si-industry" placeholder="e.g., Retail Trade" value="${escHtml(setup.industryClassification||'')}">
          </div>
          <div class="form-group full" id="income-tax-row">
            <label class="form-label">Income Tax Type</label>
            <div class="radio-group">
              <label><input type="radio" name="incomeTaxType" value="8flat" ${setup.incomeTaxType==='8flat'?'checked':''}> 8% Flat Rate</label>
              <label><input type="radio" name="incomeTaxType" value="graduated" ${setup.incomeTaxType!=='8flat'?'checked':''}> Graduated Rates (1701Q / 1701)</label>
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label">Sales Tax Type</label>
            <div class="radio-group">
              <label><input type="radio" name="salesTaxType" value="vat" ${setup.salesTaxType==='vat'?'checked':''}> Value Added Tax (2550Q / M)</label>
              <label><input type="radio" name="salesTaxType" value="pt" ${setup.salesTaxType==='pt'?'checked':''}> Percentage Tax (2551Q / M)</label>
              <label><input type="radio" name="salesTaxType" value="none" ${(!setup.salesTaxType||setup.salesTaxType==='none')?'checked':''}> None Applicable</label>
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label">Withholding Tax Types</label>
            <div class="check-group">
              <label><input type="checkbox" name="wtType" value="compensation" ${wt.includes('compensation')?'checked':''}> Compensation (1601C)</label>
              <label><input type="checkbox" name="wtType" value="expanded" ${wt.includes('expanded')?'checked':''}> Expanded (1601EQ / 0619E)</label>
              <label><input type="checkbox" name="wtType" value="final" ${wt.includes('final')?'checked':''}> Final (1601FQ / 0619F)</label>
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

function toggleIndividualFields() {
  const cl  = document.getElementById('si-classification')?.value;
  const row = document.getElementById('income-tax-row');
  if (row) row.style.display = cl === 'Individual' ? '' : 'none';
}

function saveBusinessInfo(e) {
  e.preventDefault();
  const existing = getSetup(App.currentBusiness) || {};
  const wt = [...document.querySelectorAll('input[name=wtType]:checked')].map(i => i.value);
  saveSetup(App.currentBusiness, {
    ...existing,
    taxpayerName:         document.getElementById('si-name').value.trim(),
    tin:                  document.getElementById('si-tin').value.trim(),
    address:              document.getElementById('si-address').value.trim(),
    zipCode:              document.getElementById('si-zip').value.trim(),
    rdoCode:              document.getElementById('si-rdo').value.trim(),
    classification:       document.getElementById('si-classification').value,
    industryClassification: document.getElementById('si-industry').value.trim(),
    incomeTaxType:        document.querySelector('input[name=incomeTaxType]:checked')?.value || 'graduated',
    salesTaxType:         document.querySelector('input[name=salesTaxType]:checked')?.value || 'none',
    withholdingTypes:     wt,
  });
  showToast('✅ Business info saved.');
}

// ── VAT MAPPING TAB ───────────────────────────────────────────
async function loadVATMappingTab() {
  const panel = document.getElementById('tab-vat');
  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Fetching tax codes from Manager…</span></div>`;
  try {
    const items = await fetchAllBatch('/api4/tax-code-batch', App.currentBusiness);
    _taxCodes = items.map(({ key, item }) => ({ key, name: item?.Name || key }));
    const setup  = getSetup(App.currentBusiness) || {};
    const mapping = setup.vatMapping || {};

    panel.innerHTML = `
      <div class="alert alert-info" style="margin-bottom:14px;">
        ℹ️ Select the tax code in Manager that corresponds to each BIR VAT category.
        Use <strong>Install</strong> to create a standard tax code in Manager if it doesn't exist yet.
        Then click <strong>Save Mapping</strong>.
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#0d1b3e;color:white;">
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-align:left;width:30%;">BIR Category</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;text-align:left;">Tax Code in Manager</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;width:100px;"></th>
            </tr>
          </thead>
          <tbody id="vat-map-body">
            ${VAT_CATEGORIES.map(cat => vatMapRow(cat, mapping[cat.key] || '')).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:#6b7280;">
          ${_taxCodes.length} tax code${_taxCodes.length !== 1 ? 's' : ''} found in this business.
        </div>
        <button class="btn btn-primary" onclick="saveVATMapping()">💾 Save Mapping</button>
      </div>
    `;
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function vatMapRow(cat, selectedKey) {
  const opts = _taxCodes.map(tc =>
    `<option value="${escHtml(tc.key)}" ${tc.key === selectedKey ? 'selected' : ''}>${escHtml(tc.name)}</option>`
  ).join('');
  const sideLabel = cat.side === 'sales'
    ? '<span style="font-size:9px;background:#27ae60;color:white;padding:1px 5px;border-radius:3px;margin-left:4px;">Sales</span>'
    : '<span style="font-size:9px;background:#2980b9;color:white;padding:1px 5px;border-radius:3px;margin-left:4px;">Purchase</span>';
  return `<tr style="border-bottom:1px solid #f0f0f0;" id="vmrow-${cat.key}">
    <td style="padding:9px 14px;font-size:12px;font-weight:600;color:#0d1b3e;">
      ${escHtml(cat.label)}${sideLabel}
    </td>
    <td style="padding:6px 14px;">
      <select class="form-select vm-sel" data-key="${cat.key}" style="width:100%;">
        <option value="">— Not mapped —</option>
        ${opts}
      </select>
    </td>
    <td style="padding:6px 10px;">
      <button class="btn btn-outline btn-sm" onclick="installTaxCode('${cat.key}','${escHtml(cat.defaultName)}',${cat.rate},'${cat.side}')">
        ✦ Install
      </button>
    </td>
  </tr>`;
}

async function installTaxCode(catKey, name, rate, side) {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳…';
  try {
    const newKey = crypto.randomUUID();
    await apiRequest('PUT', '/api4/tax-code-batch', {
      business: App.currentBusiness,
      values: [{ key: newKey, value: { Name: name, Rate: rate } }]
    });
    // Refresh tax codes
    const items = await fetchAllBatch('/api4/tax-code-batch', App.currentBusiness);
    _taxCodes = items.map(({ key, item }) => ({ key, name: item?.Name || key }));
    // Update dropdown for this row
    const sel = document.querySelector(`.vm-sel[data-key="${catKey}"]`);
    if (sel) {
      const opts = _taxCodes.map(tc =>
        `<option value="${escHtml(tc.key)}" ${tc.key === newKey ? 'selected' : ''}>${escHtml(tc.name)}</option>`
      ).join('');
      sel.innerHTML = `<option value="">— Not mapped —</option>${opts}`;
      sel.value = newKey;
    }
    showToast(`✅ "${name}" installed.`, 'success');
  } catch (err) {
    showToast(`❌ ${err.message}`, 'err');
  }
  btn.disabled = false;
  btn.textContent = '✦ Install';
}

function saveVATMapping() {
  const existing = getSetup(App.currentBusiness) || {};
  const mapping  = {};
  document.querySelectorAll('.vm-sel').forEach(sel => {
    mapping[sel.dataset.key] = sel.value;
  });
  saveSetup(App.currentBusiness, { ...existing, vatMapping: mapping });
  showToast('✅ VAT mapping saved.', 'success');
}

// ── CUSTOMERS / SUPPLIERS TAB ─────────────────────────────────
const PARTY_FIELDS = [
  { id: 'tin',         label: 'Vendor TIN',    width: '120px', placeholder: '000-000-000-000' },
  { id: 'branchCode',  label: 'Branch Code',   width: '80px',  placeholder: '000' },
  { id: 'companyName', label: 'Company Name',  width: '130px', placeholder: 'Corp/Company' },
  { id: 'lastName',    label: 'Last Name',     width: '110px', placeholder: 'Last' },
  { id: 'firstName',   label: 'First Name',    width: '100px', placeholder: 'First' },
  { id: 'middleName',  label: 'MI',            width: '60px',  placeholder: 'MI' },
  { id: 'address1',    label: 'Address 1',     width: '150px', placeholder: 'Unit, Bldg, Street' },
  { id: 'address2',    label: 'Address 2',     width: '130px', placeholder: 'City, Province' },
];

async function loadPartyTab(type) {
  const panel   = document.getElementById(`tab-${type}`);
  const isCust  = type === 'customers';
  const batchPath = isCust ? '/api4/customer-batch' : '/api4/supplier-batch';
  const label     = isCust ? 'customer' : 'supplier';

  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading ${label}s from Manager…</span></div>`;
  try {
    const items = await fetchAllBatch(batchPath, App.currentBusiness);
    const saved  = isCust ? getCustomers(App.currentBusiness) : getSuppliers(App.currentBusiness);

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <input type="text" class="form-input" id="${type}-search" placeholder="Search…" style="width:200px;">
        <span style="font-size:11px;color:#6b7280;">${items.length} ${label}s — click <strong>Save</strong> per row after editing.</span>
        <button class="btn btn-outline btn-sm" style="margin-left:auto;" onclick="saveAllParty('${type}')">💾 Save All</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table" id="${type}-table">
          <thead>
            <tr>
              <th>Name in Manager</th>
              ${PARTY_FIELDS.map(f => `<th>${f.label}</th>`).join('')}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map(({ key, item }) => {
              const d    = saved[key] || {};
              const name = item?.Name || key;
              return `<tr data-key="${escHtml(key)}" data-name="${escHtml(name)}">
                <td style="font-weight:600;min-width:140px;">${escHtml(name)}</td>
                ${PARTY_FIELDS.map(f =>
                  `<td><input class="form-input pf-${f.id}" style="width:${f.width};" placeholder="${f.placeholder}" value="${escHtml(d[f.id]||'')}"></td>`
                ).join('')}
                <td><button class="btn btn-primary btn-sm" onclick="savePartyRow(this,'${type}')">Save</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById(`${type}-search`).addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll(`#${type}-table tbody tr`).forEach(tr => {
        tr.style.display = tr.dataset.name?.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function savePartyRow(btn, type) {
  const tr  = btn.closest('tr');
  const key = tr.dataset.key;
  if (!key) return;
  const saved = type === 'customers' ? getCustomers(App.currentBusiness) : getSuppliers(App.currentBusiness);
  const rec   = {};
  PARTY_FIELDS.forEach(f => {
    rec[f.id] = tr.querySelector(`.pf-${f.id}`)?.value.trim() || '';
  });
  saved[key] = rec;
  if (type === 'customers') saveCustomers(App.currentBusiness, saved);
  else                      saveSuppliers(App.currentBusiness, saved);
  btn.textContent = '✅';
  btn.style.background = '#27ae60';
  setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; }, 1500);
}

function saveAllParty(type) {
  const saved = {};
  document.querySelectorAll(`#${type}-table tbody tr`).forEach(tr => {
    const key = tr.dataset.key; if (!key) return;
    const rec = {};
    PARTY_FIELDS.forEach(f => { rec[f.id] = tr.querySelector(`.pf-${f.id}`)?.value.trim() || ''; });
    saved[key] = rec;
  });
  if (type === 'customers') saveCustomers(App.currentBusiness, saved);
  else                      saveSuppliers(App.currentBusiness, saved);
  showToast(`✅ All ${type} saved.`, 'success');
}
