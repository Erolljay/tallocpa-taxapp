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

// ?? STORAGE (fallback if shared.js not loaded first) ?????????
window.getSetup  = window.getSetup  || function(b){ try{ var r=localStorage.getItem('tallocpa_setup_'+b); return r?JSON.parse(r):null; }catch(e){return null;} };
window.saveSetup = window.saveSetup || function(b,d){ localStorage.setItem('tallocpa_setup_'+b,JSON.stringify(d)); };

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
    var last = localStorage.getItem('tallocpa_last_biz');
    if (last && names.indexOf(last) >= 0) businessSelect.value = last;
    businessSelect.dispatchEvent(new Event('change'));
  } catch(e) {
    businessSelect.innerHTML = '<option value="">(could not load)</option>';
    console.error(e);
  }
})();

businessSelect && businessSelect.addEventListener('change', function() {
  localStorage.setItem('tallocpa_last_biz', businessSelect.value);
  resetCF();
  var active = document.querySelector('.tab.active');
  if (active) activateTab(active.dataset.view);
});

function currentBiz() { return businessSelect ? businessSelect.value : ''; }

// ?? TAB SWITCHING ????????????????????????????????????????????
var allViews = document.querySelectorAll('[id$="-view"]');
var cfLoaded = {};
var cfControllers = {};

function activateTab(view) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.dataset.view === view); });
  allViews.forEach(function(v){ v.hidden = v.id !== (view + '-view'); });

  var biz = currentBiz();
  if (view === 'reports')       renderReportsTab(biz);
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
    var res = await apiRequest('GET', '/api4/extension-batch?Business='+encodeURIComponent(biz)+'&Skip=0&PageSize=200');
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
        Business: biz,
        Value: { Name: btn.dataset.name, Source: 0, Endpoint: btn.dataset.ep, Placement: 'reports' }
      });
    } else {
      await apiRequest('DELETE', '/api4/extension?Business='+encodeURIComponent(biz)+'&Key='+encodeURIComponent(btn.dataset.key));
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
    var res = await apiRequest('GET', '/api4/tax-code-batch?Business='+encodeURIComponent(biz)+'&Skip=0&PageSize=200');
    _taxCodes = (res && res.items ? res.items : []).map(function(it){ return { key: it.key, value: it.item || {} }; });
  } catch(err) {
    out.innerHTML = '<div class="error">Failed: ' + escHtml(err.message) + '</div>';
    return;
  }
  renderTaxCodesOutput(biz, out);
}

function renderTaxCodesOutput(biz, out) {
  var setup  = getSetup(biz) || {};
  var vatMap = setup.vatMapping || {};
  var ewtMap = setup.ewtMapping || {};
  var fwtMap = setup.fwtMapping || {};
  var ptMap  = setup.ptMapping  || {};

  var tcOpts = '<option value="">-- not mapped --</option>' +
    _taxCodes.map(function(tc){
      return '<option value="'+escHtml(tc.key)+'">'+escHtml(tc.value.Name || tc.value.name || tc.key)+'</option>';
    }).join('');

  // 1. Tax code templates
  var groups = {};
  TAX_CODE_TEMPLATES.forEach(function(t){
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  });

  var html = sectionHeading('Tax code templates', '');
  html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
  html += '<thead><tr style="font-size:11px;color:#9ca3af;"><th style="text-align:left;padding:5px 8px;">Name</th><th style="padding:5px 8px;">Rate</th><th style="padding:5px 8px;">Group</th><th style="padding:5px 8px;">Status</th><th></th></tr></thead><tbody>';

  Object.keys(groups).forEach(function(g){
    groups[g].forEach(function(tpl){
      var match = _taxCodes.find(function(tc){
        return (tc.value.Name||tc.value.name||'').toLowerCase() === tpl.Name.toLowerCase();
      });
      html += '<tr style="border-bottom:.5px solid #f3f4f6;">';
      html += '<td style="padding:6px 8px;font-size:12px;font-weight:500;">'+escHtml(tpl.Name)+'</td>';
      html += '<td style="padding:6px 8px;font-size:12px;">'+tpl.Rate+'%</td>';
      html += '<td style="padding:6px 8px;font-size:11px;color:#9ca3af;">'+escHtml(tpl.group)+'</td>';
      html += '<td style="padding:6px 8px;">'+(match
        ? '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;">Configured</span>'
        : '<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;">Not present</span>')+'</td>';
      html += '<td style="padding:6px 8px;">'+(match
        ? '<button class="secondary" disabled style="opacity:.4;font-size:11px;">OK</button>'
        : '<button class="secondary" data-action="create-tc" data-name="'+escHtml(tpl.Name)+'" data-rate="'+tpl.Rate+'" style="font-size:11px;">Create</button>')+'</td>';
      html += '</tr>';
    });
  });
  html += '</tbody></table>';

  // 2. VAT Mapping
  html += sectionHeading('VAT Mapping', '');
  html += buildMappingTable('vat', VAT_CATEGORIES.map(function(c){
    return { key: c.key, label: c.label, sub: c.side === 'sales' ? 'Sales' : 'Purchase', selected: vatMap[c.key] || '' };
  }), tcOpts);
  html += saveMappingBtn('vat', 'Save VAT Mapping');

  // 3. EWT / CWT Mapping
  html += sectionHeading('EWT / CWT Mapping', 'Purchases (0619E, 1601EQ, QAP) and sales / receipts (SAWT, 2307)');
  html += '<p style="font-size:11px;font-weight:500;color:#6b7280;margin:0 0 4px;">Individual</p>';
  html += buildMappingTable('ewt', EWT_ATC_LIST.filter(function(a){ return a.type==='Individual'; }).map(function(a){
    return { key: a.atc, label: a.atc+' - '+a.desc, sub: a.rate+'%', selected: ewtMap[a.atc] || '' };
  }), tcOpts);
  html += '<p style="font-size:11px;font-weight:500;color:#6b7280;margin:12px 0 4px;">Non-Individual</p>';
  html += buildMappingTable('ewt', EWT_ATC_LIST.filter(function(a){ return a.type==='Non-Individual'; }).map(function(a){
    return { key: a.atc, label: a.atc+' - '+a.desc, sub: a.rate+'%', selected: ewtMap[a.atc] || '' };
  }), tcOpts);
  html += saveMappingBtn('ewt', 'Save EWT / CWT Mapping');

  // 4. FWT Mapping
  html += sectionHeading('FWT Mapping', '');
  html += buildMappingTable('fwt', FWT_ATC_LIST.map(function(a){
    return { key: a.atc, label: a.atc+' - '+a.desc, sub: a.rate+'%', selected: fwtMap[a.atc] || '' };
  }), tcOpts);
  html += saveMappingBtn('fwt', 'Save FWT Mapping');

  // 5. Percentage Tax Mapping
  html += sectionHeading('Percentage Tax Mapping', '');
  html += buildMappingTable('pt', PT_ATC_LIST.map(function(a){
    return { key: a.atc, label: a.atc+' - '+a.desc, sub: a.rate+'%', selected: ptMap[a.atc] || '' };
  }), tcOpts);
  html += saveMappingBtn('pt', 'Save Percentage Tax Mapping');

  out.innerHTML = html;

  out.querySelectorAll('[data-action="create-tc"]').forEach(function(btn){
    btn.addEventListener('click', function(){ onCreateTaxCode(btn, biz, out); });
  });
  out.querySelectorAll('[data-save-mapping]').forEach(function(btn){
    btn.addEventListener('click', function(){ onSaveMapping(btn, biz); });
  });
}

function sectionHeading(title, sub) {
  return '<h3 style="margin:0 0 8px;font-size:13px;font-weight:500;border-bottom:.5px solid #e5e7eb;padding-bottom:6px;">'+escHtml(title)+
    (sub ? '<small style="font-weight:400;font-size:11px;color:#9ca3af;margin-left:8px;">'+escHtml(sub)+'</small>' : '')+
    '</h3>';
}

function buildMappingTable(prefix, rows, tcOpts) {
  var html = '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">';
  html += '<thead><tr style="font-size:11px;color:#9ca3af;"><th style="text-align:left;padding:5px 8px;font-weight:500;width:40%;">BIR Category</th><th style="padding:5px 8px;text-align:center;width:10%;"></th><th style="padding:5px 8px;font-weight:500;">Tax code in Manager</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var opts = tcOpts.replace('value="'+escHtml(r.selected)+'"', 'value="'+escHtml(r.selected)+'" selected');
    html += '<tr style="border-bottom:.5px solid #f3f4f6;">';
    html += '<td style="padding:6px 8px;font-size:12px;font-weight:500;">'+escHtml(r.label)+'</td>';
    html += '<td style="padding:6px 8px;font-size:10px;color:#9ca3af;text-align:center;">'+escHtml(r.sub||'')+'</td>';
    html += '<td style="padding:6px 8px;"><select class="mapping-sel" data-prefix="'+prefix+'" data-key="'+escHtml(r.key)+'" style="width:100%;font-size:12px;">'+opts+'</select></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function saveMappingBtn(prefix, label) {
  return '<div style="display:flex;justify-content:flex-end;margin-bottom:28px;"><button class="primary" data-save-mapping="'+prefix+'" style="font-size:12px;">'+escHtml(label)+'</button></div>';
}

async function onCreateTaxCode(btn, biz, out) {
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    await apiRequest('POST', '/api4/tax-code', {
      Business: biz,
      Value: { Name: btn.dataset.name, Rate: parseFloat(btn.dataset.rate) / 100 }
    });
    await loadTaxCodesTab();
  } catch(err) {
    btn.disabled = false; btn.textContent = 'Create';
    alert('Failed: ' + err.message);
  }
}

function onSaveMapping(btn, biz) {
  var prefix = btn.dataset.saveMapping;
  var captured = {};
  document.querySelectorAll('.mapping-sel[data-prefix="'+prefix+'"]').forEach(function(sel){
    captured[sel.dataset.key] = sel.value;
  });
  var keyMap = { vat:'vatMapping', ewt:'ewtMapping', fwt:'fwtMapping', pt:'ptMapping' };
  var existing = getSetup(biz) || {};
  // EWT has two tables (Individual + Non-Individual) - merge instead of overwrite
  var merged = prefix === 'ewt'
    ? Object.assign({}, existing.ewtMapping || {}, captured)
    : captured;
  saveSetup(biz, Object.assign({}, existing, { [keyMap[prefix]]: merged }));
  var orig = btn.textContent;
  btn.textContent = 'Saved'; btn.disabled = true;
  setTimeout(function(){ btn.textContent = orig; btn.disabled = false; }, 1500);
}
