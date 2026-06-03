/* ============================================================
   Tallo CPA – BIR Tax App for Manager.io
   setup.js  –  Business Setup, VAT Mapping, Customer/Supplier Tabs
   ============================================================ */

// ── MAIN RENDER ──────────────────────────────────────────────
function renderSetup(el) {
  const setup = getSetup(App.currentBusiness) || {};

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">⚙️ Setup</div>
        <div class="page-subtitle">${escHtml(App.currentBusiness)}</div>
      </div>
    </div>

    <div class="tab-bar" id="setup-tab-bar">
      <button class="tab-btn active" data-tab="business">Business Info</button>
      <button class="tab-btn" data-tab="vat-map">VAT Mapping</button>
      <button class="tab-btn" data-tab="customers">Customers</button>
      <button class="tab-btn" data-tab="suppliers">Suppliers</button>
    </div>

    <div id="tab-business" class="tab-panel active">${renderBusinessInfoTab(setup)}</div>
    <div id="tab-vat-map"  class="tab-panel">${renderVatMappingTab(setup)}</div>
    <div id="tab-customers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading customers…</span></div></div>
    <div id="tab-suppliers" class="tab-panel"><div class="spinner-wrap"><div class="spinner"></div><span>Loading suppliers…</span></div></div>
  `;

  // Tab switching
  document.getElementById('setup-tab-bar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

    if (tab === 'customers') loadCustomersTab();
    if (tab === 'suppliers') loadSuppliersTab();
  });

  // Business info form submit
  document.getElementById('business-info-form')?.addEventListener('submit', saveBusinessInfo);

  // Classification change — toggle income tax type visibility
  document.getElementById('si-classification')?.addEventListener('change', toggleIndividualFields);
  toggleIndividualFields();

  // VAT map save
  document.getElementById('vat-map-form')?.addEventListener('submit', saveVatMapping);

  // CWT accounts
  document.getElementById('btn-add-cwt')?.addEventListener('click', addCwtRow);
}

// ── TAB: BUSINESS INFO ───────────────────────────────────────
function renderBusinessInfoTab(setup) {
  const wt = setup.withholdingTypes || [];
  return `
  <form id="business-info-form">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

      <!-- LEFT: Taxpayer Details -->
      <div>
        <div class="card-title">Taxpayer Details</div>
        <div class="form-grid">
          <div class="form-group full">
            <label class="form-label">Taxpayer Name</label>
            <input class="form-input" id="si-name" placeholder="Juan Dela Cruz or ABC Corporation"
              value="${escHtml(setup.taxpayerName || '')}" required>
          </div>
          <div class="form-group full">
            <label class="form-label">Taxpayer Identification Number (TIN)</label>
            <input class="form-input" id="si-tin" placeholder="000-000-000-000"
              value="${escHtml(setup.tin || '')}" maxlength="20">
          </div>
          <div class="form-group full">
            <label class="form-label">Registered Address</label>
            <textarea class="form-textarea" id="si-address" placeholder="Unit/Floor, Building, Street, Barangay">${escHtml(setup.address || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Zip Code</label>
            <input class="form-input" id="si-zip" placeholder="e.g., 5000" value="${escHtml(setup.zipCode || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">RDO Code</label>
            <input class="form-input" id="si-rdo" placeholder="e.g., 083" value="${escHtml(setup.rdoCode || '')}">
          </div>
        </div>
      </div>

      <!-- RIGHT: Filing Information -->
      <div>
        <div class="card-title">Filing Information</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Taxpayer Classification</label>
            <select class="form-select" id="si-classification">
              <option value="Individual" ${setup.classification === 'Individual' ? 'selected' : ''}>Individual</option>
              <option value="Non-Individual" ${setup.classification === 'Non-Individual' ? 'selected' : ''}>Non-Individual / Corporation</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Industry Classification</label>
            <input class="form-input" id="si-industry" placeholder="Type or select industry"
              value="${escHtml(setup.industryClassification || '')}">
          </div>

          <div class="form-group full" id="income-tax-row">
            <label class="form-label">Income Tax Type</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="incomeTaxType" value="8flat"
                  ${setup.incomeTaxType === '8flat' ? 'checked' : ''}>
                8% Flat Rate
              </label>
              <label>
                <input type="radio" name="incomeTaxType" value="graduated"
                  ${setup.incomeTaxType !== '8flat' ? 'checked' : ''}>
                Graduated Rates (1701Q / 1701)
              </label>
            </div>
          </div>

          <div class="form-group full">
            <label class="form-label">Sales Tax Type</label>
            <div class="radio-group">
              <label>
                <input type="radio" name="salesTaxType" value="pt"
                  ${setup.salesTaxType === 'pt' ? 'checked' : ''}>
                Percentage Tax (2551Q / M)
              </label>
              <label>
                <input type="radio" name="salesTaxType" value="vat"
                  ${setup.salesTaxType === 'vat' ? 'checked' : ''}>
                Value Added Tax (2550Q / M)
              </label>
              <label>
                <input type="radio" name="salesTaxType" value="none"
                  ${(!setup.salesTaxType || setup.salesTaxType === 'none') ? 'checked' : ''}>
                None Applicable
              </label>
            </div>
          </div>

          <div class="form-group full">
            <label class="form-label">Withholding Tax Types (select all applicable)</label>
            <div class="check-group">
              <label>
                <input type="checkbox" name="wtType" value="compensation"
                  ${wt.includes('compensation') ? 'checked' : ''}>
                Compensation (1601C)
              </label>
              <label>
                <input type="checkbox" name="wtType" value="expanded"
                  ${wt.includes('expanded') ? 'checked' : ''}>
                Expanded (1601EQ / 0619E)
              </label>
              <label>
                <input type="checkbox" name="wtType" value="final"
                  ${wt.includes('final') ? 'checked' : ''}>
                Final (1601FQ / 0619F)
              </label>
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
  const cl = document.getElementById('si-classification')?.value;
  const row = document.getElementById('income-tax-row');
  if (row) row.style.display = cl === 'Individual' ? '' : 'none';
}

function saveBusinessInfo(e) {
  e.preventDefault();
  const existing = getSetup(App.currentBusiness) || {};
  const wt = [...document.querySelectorAll('input[name=wtType]:checked')].map(i => i.value);
  const salesTaxType = document.querySelector('input[name=salesTaxType]:checked')?.value || 'none';
  const incomeTaxType = document.querySelector('input[name=incomeTaxType]:checked')?.value || 'graduated';

  const updated = {
    ...existing,
    taxpayerName: document.getElementById('si-name').value.trim(),
    tin: document.getElementById('si-tin').value.trim(),
    address: document.getElementById('si-address').value.trim(),
    zipCode: document.getElementById('si-zip').value.trim(),
    rdoCode: document.getElementById('si-rdo').value.trim(),
    classification: document.getElementById('si-classification').value,
    industryClassification: document.getElementById('si-industry').value.trim(),
    incomeTaxType,
    salesTaxType,
    withholdingTypes: wt,
  };

  saveSetup(App.currentBusiness, updated);
  updateNavVisibility();
  showToast('✅ Business info saved.');
}

// ── TAB: VAT MAPPING ─────────────────────────────────────────
function renderVatMappingTab(setup) {
  const vm = setup.vatMapping || {};
  const s = vm.sales || {};
  const p = vm.purchases || {};
  const cwt = vm.cwtAccounts || [];

  return `
  <form id="vat-map-form">
    <div class="alert alert-info" style="margin-bottom:16px;">
      ℹ️ Map each BIR VAT category to the exact tax code name used in Manager.io for this business.
      Tax codes are fetched from Manager — select from the dropdowns or type manually.
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;">

      <!-- SALES TAX CODES -->
      <div class="card" style="margin:0;">
        <div class="card-title">Sales Tax Code Mapping</div>
        <table class="map-table">
          <tr>
            <td>Taxable Sales (12% VAT)</td>
            <td><input class="form-input" id="vm-s-taxable" placeholder="e.g., Output VAT 12%"
              value="${escHtml(s.taxable || '')}"></td>
          </tr>
          <tr>
            <td>Zero-Rated Sales</td>
            <td><input class="form-input" id="vm-s-zero" placeholder="e.g., Zero-Rated"
              value="${escHtml(s.zeroRated || '')}"></td>
          </tr>
          <tr>
            <td>Exempt Sales</td>
            <td><input class="form-input" id="vm-s-exempt" placeholder="e.g., VAT Exempt"
              value="${escHtml(s.exempt || '')}"></td>
          </tr>
        </table>
      </div>

      <!-- PURCHASE TAX CODES -->
      <div class="card" style="margin:0;">
        <div class="card-title">Purchase Tax Code Mapping</div>
        <table class="map-table">
          <tr>
            <td>Capital Goods</td>
            <td><input class="form-input" id="vm-p-capital" placeholder="e.g., Input VAT - Capital Goods"
              value="${escHtml(p.capitalGoods || '')}"></td>
          </tr>
          <tr>
            <td>Other than Capital Goods</td>
            <td><input class="form-input" id="vm-p-other" placeholder="e.g., Input VAT - Other Goods"
              value="${escHtml(p.otherThanCapitalGoods || '')}"></td>
          </tr>
          <tr>
            <td>Services</td>
            <td><input class="form-input" id="vm-p-services" placeholder="e.g., Input VAT - Services"
              value="${escHtml(p.services || '')}"></td>
          </tr>
          <tr>
            <td>Zero-Rated Purchases</td>
            <td><input class="form-input" id="vm-p-zero" placeholder="e.g., Zero-Rated Purchase"
              value="${escHtml(p.zeroRated || '')}"></td>
          </tr>
          <tr>
            <td>Exempt Purchases</td>
            <td><input class="form-input" id="vm-p-exempt" placeholder="e.g., Exempt Purchase"
              value="${escHtml(p.exempt || '')}"></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CWT ACCOUNTS (SAWT) -->
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;">
        <span>Creditable Withholding Tax Accounts <small style="font-weight:400;color:#6b7280;">(used in SAWT — negative line items on Sales receipts)</small></span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-cwt">+ Add Account</button>
      </div>
      <div class="alert alert-info" style="margin-bottom:12px;">
        Map each CWT account name from Manager to its type. These are negative line items on your sales invoices/receipts representing tax withheld by customers.
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Account Name in Manager</th>
            <th>Type</th>
            <th style="width:40px;"></th>
          </tr>
        </thead>
        <tbody id="cwt-tbody">
          ${cwt.map((r, i) => renderCwtRow(r, i)).join('')}
        </tbody>
      </table>
    </div>

    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;">
      <button type="submit" class="btn btn-primary">💾 Save VAT Mapping</button>
    </div>
  </form>`;
}

function renderCwtRow(row = {}, i) {
  return `<tr data-cwt-row="${i}">
    <td><input class="form-input cwt-account" placeholder="e.g., Creditable Withholding Tax"
      value="${escHtml(row.accountName || '')}"></td>
    <td>
      <select class="form-select cwt-type">
        <option value="2307" ${row.type === '2307' ? 'selected' : ''}>2307 — CWT from customers</option>
        <option value="5pct-wv" ${row.type === '5pct-wv' ? 'selected' : ''}>5% Withholding VAT (Govt clients)</option>
      </select>
    </td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('tr').remove()">✕</button></td>
  </tr>`;
}

function addCwtRow() {
  const tbody = document.getElementById('cwt-tbody');
  const i = tbody.querySelectorAll('tr').length;
  tbody.insertAdjacentHTML('beforeend', renderCwtRow({}, i));
}

function saveVatMapping(e) {
  e.preventDefault();
  const existing = getSetup(App.currentBusiness) || {};

  const cwt = [...document.querySelectorAll('#cwt-tbody tr')].map(tr => ({
    accountName: tr.querySelector('.cwt-account')?.value.trim() || '',
    type: tr.querySelector('.cwt-type')?.value || '2307',
  })).filter(r => r.accountName);

  const updated = {
    ...existing,
    vatMapping: {
      sales: {
        taxable:  document.getElementById('vm-s-taxable')?.value.trim() || '',
        zeroRated: document.getElementById('vm-s-zero')?.value.trim() || '',
        exempt:   document.getElementById('vm-s-exempt')?.value.trim() || '',
      },
      purchases: {
        capitalGoods:        document.getElementById('vm-p-capital')?.value.trim() || '',
        otherThanCapitalGoods: document.getElementById('vm-p-other')?.value.trim() || '',
        services:            document.getElementById('vm-p-services')?.value.trim() || '',
        zeroRated:           document.getElementById('vm-p-zero')?.value.trim() || '',
        exempt:              document.getElementById('vm-p-exempt')?.value.trim() || '',
      },
      cwtAccounts: cwt,
    },
  };

  saveSetup(App.currentBusiness, updated);
  showToast('✅ VAT mapping saved.');
}

// ── TAB: CUSTOMERS ───────────────────────────────────────────
async function loadCustomersTab() {
  const panel = document.getElementById('tab-customers');
  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading customers from Manager…</span></div>`;

  try {
    const items = await fetchAllBatch('/api4/customer-batch', App.currentBusiness);
    const saved = getCustomers(App.currentBusiness);

    panel.innerHTML = `
      <div class="page-header" style="margin-bottom:12px;">
        <div>
          <div style="font-size:13px;color:#6b7280;">Add TIN and address details for customers (used in SLS and 2307 received).</div>
        </div>
        <div class="btn-group">
          <input type="text" class="form-input" id="cust-search" placeholder="Search name…" style="width:200px;">
          <button class="btn btn-primary btn-sm" onclick="saveAllCustomers()">💾 Save All</button>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table" id="cust-table">
          <thead>
            <tr>
              <th>Name in Manager</th>
              <th>Type</th>
              <th>TIN</th>
              <th>Last Name / Corp Name</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Address Line 1</th>
              <th>Address Line 2</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(({ key, item }) => {
              const d = saved[key] || {};
              const name = item?.Name || key;
              return `<tr data-key="${escHtml(key)}">
                <td style="min-width:140px;font-weight:600;">${escHtml(name)}</td>
                <td>
                  <select class="form-select cust-type" style="width:130px;">
                    <option value="Non-Individual" ${d.type !== 'Individual' ? 'selected' : ''}>Non-Individual</option>
                    <option value="Individual" ${d.type === 'Individual' ? 'selected' : ''}>Individual</option>
                  </select>
                </td>
                <td><input class="form-input cust-tin" style="width:130px;" placeholder="000-000-000-000"
                  value="${escHtml(d.tin || '')}"></td>
                <td><input class="form-input cust-ln" style="width:140px;" placeholder="Corp or Last Name"
                  value="${escHtml(d.lastName || d.corpName || '')}"></td>
                <td><input class="form-input cust-fn" style="width:110px;" placeholder="First"
                  value="${escHtml(d.firstName || '')}"></td>
                <td><input class="form-input cust-mn" style="width:90px;" placeholder="MI"
                  value="${escHtml(d.middleName || '')}"></td>
                <td><input class="form-input cust-a1" style="width:160px;" placeholder="Unit, Bldg, Street"
                  value="${escHtml(d.address1 || '')}"></td>
                <td><input class="form-input cust-a2" style="width:140px;" placeholder="City/Municipality, Province"
                  value="${escHtml(d.address2 || '')}"></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // Live search
    document.getElementById('cust-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#cust-table tbody tr').forEach(tr => {
        tr.style.display = tr.children[0]?.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ Failed to load customers: ${escHtml(err.message)}</div>`;
  }
}

function saveAllCustomers() {
  const data = {};
  document.querySelectorAll('#cust-table tbody tr').forEach(tr => {
    const key = tr.dataset.key;
    if (!key) return;
    const type = tr.querySelector('.cust-type')?.value;
    const tin  = tr.querySelector('.cust-tin')?.value.trim();
    const ln   = tr.querySelector('.cust-ln')?.value.trim();
    const fn   = tr.querySelector('.cust-fn')?.value.trim();
    const mn   = tr.querySelector('.cust-mn')?.value.trim();
    const a1   = tr.querySelector('.cust-a1')?.value.trim();
    const a2   = tr.querySelector('.cust-a2')?.value.trim();
    data[key] = { type, tin, lastName: ln, firstName: fn, middleName: mn,
                  corpName: type === 'Non-Individual' ? ln : '', address1: a1, address2: a2 };
  });
  saveCustomers(App.currentBusiness, data);
  showToast('✅ Customer details saved.');
}

// ── TAB: SUPPLIERS ───────────────────────────────────────────
async function loadSuppliersTab() {
  const panel = document.getElementById('tab-suppliers');
  panel.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading suppliers from Manager…</span></div>`;

  try {
    const items = await fetchAllBatch('/api4/supplier-batch', App.currentBusiness);
    const saved = getSuppliers(App.currentBusiness);

    panel.innerHTML = `
      <div class="page-header" style="margin-bottom:12px;">
        <div>
          <div style="font-size:13px;color:#6b7280;">Add TIN and details for suppliers (used in SLP and 2307 generated).</div>
        </div>
        <div class="btn-group">
          <input type="text" class="form-input" id="supp-search" placeholder="Search name…" style="width:200px;">
          <button class="btn btn-primary btn-sm" onclick="saveAllSuppliers()">💾 Save All</button>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table" id="supp-table">
          <thead>
            <tr>
              <th>Name in Manager</th>
              <th>Type</th>
              <th>TIN</th>
              <th>Last Name / Corp Name</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Address Line 1</th>
              <th>Address Line 2</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(({ key, item }) => {
              const d = saved[key] || {};
              const name = item?.Name || key;
              return `<tr data-key="${escHtml(key)}">
                <td style="min-width:140px;font-weight:600;">${escHtml(name)}</td>
                <td>
                  <select class="form-select supp-type" style="width:130px;">
                    <option value="Non-Individual" ${d.type !== 'Individual' ? 'selected' : ''}>Non-Individual</option>
                    <option value="Individual" ${d.type === 'Individual' ? 'selected' : ''}>Individual</option>
                  </select>
                </td>
                <td><input class="form-input supp-tin" style="width:130px;" placeholder="000-000-000-000"
                  value="${escHtml(d.tin || '')}"></td>
                <td><input class="form-input supp-ln" style="width:140px;" placeholder="Corp or Last Name"
                  value="${escHtml(d.lastName || d.corpName || '')}"></td>
                <td><input class="form-input supp-fn" style="width:110px;" placeholder="First"
                  value="${escHtml(d.firstName || '')}"></td>
                <td><input class="form-input supp-mn" style="width:90px;" placeholder="MI"
                  value="${escHtml(d.middleName || '')}"></td>
                <td><input class="form-input supp-a1" style="width:160px;" placeholder="Unit, Bldg, Street"
                  value="${escHtml(d.address1 || '')}"></td>
                <td><input class="form-input supp-a2" style="width:140px;" placeholder="City/Municipality, Province"
                  value="${escHtml(d.address2 || '')}"></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('supp-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#supp-table tbody tr').forEach(tr => {
        tr.style.display = tr.children[0]?.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-error">❌ Failed to load suppliers: ${escHtml(err.message)}</div>`;
  }
}

function saveAllSuppliers() {
  const data = {};
  document.querySelectorAll('#supp-table tbody tr').forEach(tr => {
    const key = tr.dataset.key;
    if (!key) return;
    const type = tr.querySelector('.supp-type')?.value;
    const tin  = tr.querySelector('.supp-tin')?.value.trim();
    const ln   = tr.querySelector('.supp-ln')?.value.trim();
    const fn   = tr.querySelector('.supp-fn')?.value.trim();
    const mn   = tr.querySelector('.supp-mn')?.value.trim();
    const a1   = tr.querySelector('.supp-a1')?.value.trim();
    const a2   = tr.querySelector('.supp-a2')?.value.trim();
    data[key] = { type, tin, lastName: ln, firstName: fn, middleName: mn,
                  corpName: type === 'Non-Individual' ? ln : '', address1: a1, address2: a2 };
  });
  saveSuppliers(App.currentBusiness, data);
  showToast('✅ Supplier details saved.');
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:#1a2f5e;color:white;
      padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;
      box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}
