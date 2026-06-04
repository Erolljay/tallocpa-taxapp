/* ============================================================
   Tallo CPA - Philippines BIR Extension
   app.js - Tab switching, business selector, report install,
            tax code setup + all mapping sections,
            CF section wiring (lazy mount on tab activate).
   Mirrors AU extension architecture.
   Uses postMessage bridge (apiRequest from shared.js).
   ============================================================ */

// ?? UTILITIES ????????????????????????????????????????????????
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Storage helpers are defined in shared.js (getSetup, saveSetup, getCustomers, etc.)

// ?? BUSINESS SELECTOR ????????????????????????????????????????
var businessSelect = document.getElementById('business');

(async function loadBusinesses() {
  if (!businessSelect) return;
  try {
    var res = await apiRequest('GET', '/api4/businesses');
    var names = (res && res.businesses ? res.businesses : []).map(function(b){ return b.name; }).sort(function(a,b){ return a.localeCompare(b); });
    if (!names.length) {
      businessSelect.innerHTML = '<option value="">(no businesses found)</option>';
      return;
    }
    businessSelect.innerHTML = '<option value="">-- select a business --</option>' +
      names.map(function(n){ return '<option value="'+escHtml(n)+'">'+escHtml(n)+'</option>'; }).join('');
    if (names.length) businessSelect.value = names[0];
    businessSelect.dispatchEvent(new Event('change'));
  } catch(e) {
    businessSelect.innerHTML = '<option value="">(could not load)</option>';
    console.error(e);
  }
})();

businessSelect && businessSelect.addEventListener('change', function() {
  setupTabLoaded = false; // reset so tax codes reload for new business
  resetCF();
  var active = document.querySelector('.tab.active');
  if (active) activateTab(active.dataset.view);
  // Explicitly refresh the active CF section after mount to ensure data loads
  var view = active ? active.dataset.view : '';
  var sectionMap = { business: 'business', customers: 'customers', suppliers: 'suppliers', employees: 'employees', 'payslip-items': 'payslipItems' };
  var section = sectionMap[view];
  if (section && cfControllers[section] && typeof cfControllers[section].refresh === 'function') {
    cfControllers[section].refresh();
  }
});

function currentBiz() { return businessSelect ? businessSelect.value : ''; }

// ?? TAB SWITCHING ????????????????????????????????????????????
var allViews = document.querySelectorAll('[id$="-view"]');
var cfLoaded = {};
var cfControllers = {};
var setupTabLoaded = false;

function activateTab(view) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.dataset.view === view); });
  allViews.forEach(function(v){ v.hidden = v.id !== (view + '-view'); });

  var biz = currentBiz();
  if (view === 'reports')       renderReportsTab(biz);
  if (view === 'setup' && !setupTabLoaded && biz) { setupTabLoaded = true; loadTaxCodesTab(); }
  if (view === 'business')      lazyMountCF('business',     biz);
  if (view === 'customers')     lazyMountCF('customers',    biz);
  if (view === 'suppliers')     lazyMountCF('suppliers',    biz);
  if (view === 'employees')     lazyMountCF('employees',    biz);
  if (view === 'payslip-items') lazyMountCF('payslipItems', biz);
}

document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){ activateTab(t.dataset.view); });
});

function lazyMountCF(section, biz) {
  if (!biz || typeof CF === 'undefined') return;
  var key = biz + '__' + section;
  if (cfLoaded[key]) return;
  cfLoaded[key] = true;

  if (section === 'business') {
    cfControllers.business = CF.mountBusiness(document.getElementById('business-view'));
    cfControllers.business.refresh();
  } else if (section === 'customers') {
    cfControllers.customers = CF.mountParty(document.getElementById('customers-view'), 'customer');
    cfControllers.customers.refresh();
  } else if (section === 'suppliers') {
    cfControllers.suppliers = CF.mountParty(document.getElementById('suppliers-view'), 'supplier');
    cfControllers.suppliers.refresh();
  } else if (section === 'employees') {
    cfControllers.employees = CF.mountEmployees(document.getElementById('employees-view'));
    cfControllers.employees.refresh();
  } else if (section === 'payslipItems') {
    cfControllers.payslipItems = CF.mountPayslipItems(document.getElementById('payslip-items-view'));
    cfControllers.payslipItems.refresh();
  }
}

function resetCF() {
  Object.keys(cfLoaded).forEach(function(k){ delete cfLoaded[k]; });
  cfControllers = {};
  ['business-view','customers-view','suppliers-view','employees-view','payslip-items-view'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

// ?? REPORTS TAB ??????????????????????????????????????????????
// All reports are shown regardless of tax type ? user decides what to install.
var _installed = [];

async function renderReportsTab(biz) {
  var container = document.getElementById('report-install-list');
  if (!container) return;
  if (!biz) {
    container.innerHTML = '<p class="muted">Select a business above to see report status.</p>';
    return;
  }
  container.innerHTML = '<div class="status">Loading...</div>';
  try {
    var res = await apiRequest('GET', '/api4/extension-batch?business='+encodeURIComponent(biz)+'&Skip=0&PageSize=200');
    _installed = (res && res.items ? res.items : []).map(function(it){ return { key: it.key, value: it.item || {} }; });
  } catch(e) { _installed = []; }
  buildReportTable(biz, container);
}

function buildReportTable(biz, container) {
  var groups = {};
  REPORTS.forEach(function(r) {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });

  var html = '';
  Object.keys(groups).forEach(function(group) {
    var list = groups[group];
    html += '<h3 style="margin:18px 0 6px;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:.5px solid #e5e7eb;padding-bottom:4px;">'+escHtml(group)+'</h3>';
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:4px;">';
    html += '<thead><tr style="font-size:11px;color:#9ca3af;"><th style="text-align:left;padding:5px 8px;font-weight:500;">Report</th><th style="padding:5px 8px;font-weight:500;text-align:center;">Status</th><th style="padding:5px 8px;font-weight:500;text-align:center;">Action</th></tr></thead><tbody>';

    list.forEach(function(r) {
      var ep = reportEndpoint(r);
      var inst = _installed.find(function(e){ return (e.value.Endpoint || e.value.endpoint) === ep; });
      var badge, action;
      if (!r.available) {
        var label = r.phase >= 3 ? 'Phase 3' : 'Phase 2';
        badge  = '<span style="font-size:10px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;">'+label+'</span>';
        action = '<button class="secondary" disabled style="opacity:.4;font-size:11px;">Install</button>';
      } else if (inst) {
        badge  = '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;">Installed</span>';
        action = '<button class="secondary" data-action="uninstall" data-key="'+escHtml(inst.key)+'" style="font-size:11px;">Uninstall</button>';
      } else {
        badge  = '<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;">Not installed</span>';
        action = '<button class="secondary" data-action="install" data-name="'+escHtml(r.name)+'" data-ep="'+escHtml(ep)+'" style="font-size:11px;">Install</button>';
      }
      html += '<tr style="border-bottom:.5px solid #f3f4f6;"><td style="padding:7px 8px;font-size:12px;font-weight:500;">'+escHtml(r.name)+'</td><td style="padding:7px 8px;text-align:center;">'+badge+'</td><td style="padding:7px 8px;text-align:center;">'+action+'</td></tr>';
    });
    html += '</tbody></table>';
  });

  container.innerHTML = html;
  container.querySelectorAll('button[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){ onReportAction(btn, biz); });
  });
}

async function onReportAction(btn, biz) {
  var action = btn.dataset.action;
  btn.disabled = true;
  btn.textContent = action === 'install' ? 'Installing...' : 'Uninstalling...';
  try {
    if (action === 'install') {
      await apiRequest('POST', '/api4/extension', {
        business: biz,
        value: { Name: btn.dataset.name, Source: 0, Endpoint: btn.dataset.ep, Placement: 'reports' }
      });
    } else {
      await apiRequest('DELETE', '/api4/extension?business='+encodeURIComponent(biz)+'&key='+encodeURIComponent(btn.dataset.key));
    }
    await renderReportsTab(biz);
  } catch(err) {
    btn.disabled = false;
    btn.textContent = action === 'install' ? 'Install' : 'Uninstall';
    alert('Failed: ' + err.message);
  }
}

// ?? TAX CODES TAB ????????????????????????????????????????????
var _taxCodes = [];

var refreshBtn = document.getElementById('refreshSetup');
if (refreshBtn) refreshBtn.addEventListener('click', loadTaxCodesTab);

async function loadTaxCodesTab() {
  var biz = currentBiz();
  var out = document.getElementById('setupOutput');
  if (!biz) { out.innerHTML = '<div class="error">Please select a business.</div>'; return; }
  out.innerHTML = '<div class="status">Loading tax codes...</div>';
  try {
    var res = await apiRequest('GET', '/api4/tax-code-batch?business='+encodeURIComponent(biz)+'&Skip=0&PageSize=200');
    _taxCodes = (res && res.items ? res.items : []).map(function(it){ return { key: it.key, value: it.item || {} }; });
  } catch(err) {
    out.innerHTML = '<div class="error">Failed to load: ' + escHtml(err.message) + '</div>';
    return;
  }
  renderTaxCodesOutput(biz, out);
}

// ── TAX CODE GROUP DEFINITIONS ────────────────────────────────
var TC_GROUPS = [
  { key: 'VAT',  label: 'Business Tax Codes — VAT',                        sub: 'Output and input VAT for VAT-registered businesses' },
  { key: 'PT',   label: 'Business Tax Codes — Percentage Tax',             sub: 'PT010, PT040, PT101 — for non-VAT / specific industries' },
  { key: 'EWT',  label: 'EWT / CWT on Income Payments',                   sub: 'Withheld from suppliers (WI/WC series) — Manager rate = 100%' },
  { key: 'GOVT', label: 'EWT / CWT — Government Withheld from You',       sub: 'Final withholding VAT (WV) + PT (WB) — Manager rate = 100%' },
  { key: 'FWT',  label: 'Final Withholding Tax',                          sub: 'Passive income: royalties, interest, dividends — Manager rate = 100%' },
];

function renderTaxCodesOutput(biz, out) {
  // Build name → {key, value} lookup from Manager tax codes
  var tcByName = {};
  _taxCodes.forEach(function(tc) {
    var n = (tc.value.Name || tc.value.name || '').toLowerCase().trim();
    if (n) tcByName[n] = tc;
  });

  var html = '<p style="font-size:11px;color:#6b7280;margin-bottom:16px;">' +
    'All tax codes are pre-defined. Status shows whether each code exists in this business. ' +
    'Click <strong>Create</strong> to add missing codes or <strong>Create All Missing</strong> per group.' +
    '</p>';

  TC_GROUPS.forEach(function(grp) {
    var codes = TAX_CODE_TEMPLATES.filter(function(t){ return t.group === grp.key; });
    if (!codes.length) return;

    var missing = codes.filter(function(t){ return !tcByName[t.Name.toLowerCase().trim()]; });

    html += '<div style="margin-bottom:24px;">';
    html += '<div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1.5px solid #e5e7eb;padding-bottom:6px;margin-bottom:8px;">';
    html += '<div>';
    html += '<span style="font-size:13px;font-weight:600;color:#1a2f5e;">'+escHtml(grp.label)+'</span>';
    html += '<span style="font-size:11px;color:#9ca3af;margin-left:8px;">'+escHtml(grp.sub)+'</span>';
    html += '</div>';
    if (missing.length) {
      html += '<button class="secondary" data-action="create-group" data-group="'+escHtml(grp.key)+'" style="font-size:11px;padding:3px 10px;">Create All Missing ('+missing.length+')</button>';
    } else {
      html += '<span style="font-size:11px;color:#27ae60;font-weight:500;">✓ All present</span>';
    }
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;">';
    html += '<th style="text-align:left;padding:4px 8px;font-weight:500;">Tax Code Name</th>';
    html += '<th style="padding:4px 8px;font-weight:500;text-align:center;">BIR Rate</th>';
    html += '<th style="padding:4px 8px;font-weight:500;text-align:center;">Manager Rate</th>';
    html += '<th style="padding:4px 8px;font-weight:500;text-align:center;">Status</th>';
    html += '<th style="padding:4px 8px;"></th>';
    html += '</tr></thead><tbody>';

    codes.forEach(function(tpl) {
      var match = tcByName[tpl.Name.toLowerCase().trim()];
      var birRateStr  = tpl.birRate > 0 ? tpl.birRate + '%' : '0%';
      var mgrRateStr  = tpl.managerRate === 100 ? '100% *' : tpl.managerRate + '%';
      var badge = match
        ? '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;">✓ Found</span>'
        : '<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;">Missing</span>';
      var action = match
        ? '<span style="font-size:11px;color:#9ca3af;">—</span>'
        : '<button class="secondary" data-action="create-tc" data-name="'+escHtml(tpl.Name)+'" data-mgr-rate="'+tpl.managerRate+'" data-group="'+escHtml(tpl.group)+'" style="font-size:11px;padding:3px 10px;">Create</button>';
      html += '<tr style="border-bottom:.5px solid #f3f4f6;">';
      html += '<td style="padding:6px 8px;font-size:12px;font-weight:500;">'+escHtml(tpl.Name)+'</td>';
      html += '<td style="padding:6px 8px;font-size:12px;text-align:center;color:#374151;">'+birRateStr+'</td>';
      html += '<td style="padding:6px 8px;font-size:12px;text-align:center;color:'+(tpl.managerRate===100?'#b45309':'#374151')+';">'+mgrRateStr+'</td>';
      html += '<td style="padding:6px 8px;text-align:center;">'+badge+'</td>';
      html += '<td style="padding:6px 8px;text-align:center;">'+action+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (grp.key !== 'VAT' && grp.key !== 'PT') {
      html += '<p style="font-size:10px;color:#9ca3af;margin:4px 8px 0;">* Manager rate 100% = line amount entered by accountant IS the withholding tax amount.</p>';
    }
    html += '</div>';
  });

  out.innerHTML = html;

  // Single create
  out.querySelectorAll('[data-action="create-tc"]').forEach(function(btn){
    btn.addEventListener('click', function(){ onCreateTaxCode(btn, biz); });
  });
  // Create all missing in group
  out.querySelectorAll('[data-action="create-group"]').forEach(function(btn){
    btn.addEventListener('click', function(){ onCreateGroupTaxCodes(btn, biz); });
  });
}

// Derive Manager TaxType from group + name
function getTaxType(group, name) {
  if (group === 'EWT' || group === 'GOVT' || group === 'FWT') return 4;
  if (group === 'PT') return 0;  // Percentage tax treated as output-type in Manager
  // VAT group
  var n = (name || '').toLowerCase();
  if (n.includes('capital')) return 2;
  if (n.includes('input') || n.includes('purchase')) return 1;
  return 0; // output VAT, zero-rated sales, exempt sales
}

async function onCreateTaxCode(btn, biz) {
  var name    = btn.dataset.name;
  var mgrRate = parseFloat(btn.dataset.mgrRate);
  var group   = btn.dataset.group || '';
  var taxType = getTaxType(group, name);
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await apiRequest('POST', '/api4/tax-code', {
      business: biz,
      value: { Name: name, Component: [{ TaxType: taxType, Rate: mgrRate }] }
    });
    await loadTaxCodesTab();
  } catch(err) {
    btn.disabled = false; btn.textContent = 'Create';
    alert('Failed: ' + err.message);
  }
}

async function onCreateGroupTaxCodes(btn, biz) {
  var grpKey  = btn.dataset.group;
  var tcByName = {};
  _taxCodes.forEach(function(tc){
    var n = (tc.value.Name||tc.value.name||'').toLowerCase().trim();
    if (n) tcByName[n] = true;
  });
  var missing = TAX_CODE_TEMPLATES.filter(function(t){
    return t.group === grpKey && !tcByName[t.Name.toLowerCase().trim()];
  });
  if (!missing.length) return;
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    for (var i = 0; i < missing.length; i++) {
      var m = missing[i];
      var taxType = getTaxType(m.group, m.Name);
      await apiRequest('POST', '/api4/tax-code', {
        business: biz,
        value: { Name: m.Name, Component: [{ TaxType: taxType, Rate: m.managerRate }] }
      });
    }
    await loadTaxCodesTab();
  } catch(err) {
    btn.disabled = false; btn.textContent = 'Create All Missing';
    alert('Failed on "'+missing[i]+'": ' + err.message);
  }
}

// placeholder so nothing breaks if old ref exists
async function onSaveMapping() {}

