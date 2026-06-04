// Custom-field setup for the PH (Philippines BIR) extension.
// Field GUIDs are stable identifiers -- DO NOT CHANGE after first use.
// Uses postMessage bridge (apiRequest from shared.js) -- NOT direct fetch.
//
// Business section mirrors AU extension:
//   - Data stored IN Manager's business record as custom fields
//   - Form renders immediately (no spinner), loads from Manager in background
//   - On save: writes to Manager first, caches to localStorage for reports

(function () {

  var BUSINESS_FIELDS = [
    { id: 'b1r00001-0000-4000-a000-000000000001', label: 'TIN',                       type: 'text',   placeholder: '000-000-000-000' },
    { id: 'b1r00001-0000-4000-a000-000000000002', label: 'RDO Code',                  type: 'text',   placeholder: 'e.g. 083' },
    { id: 'b1r00001-0000-4000-a000-000000000003', label: 'Zip Code',                  type: 'text',   placeholder: 'e.g. 5000' },
    { id: 'b1r00001-0000-4000-a000-000000000004', label: 'Taxpayer Classification',   type: 'select', options: ['', 'Non-Individual / Corporation', 'Individual'] },
    { id: 'b1r00001-0000-4000-a000-000000000005', label: 'Industry Classification',   type: 'text',   placeholder: 'e.g. Retail Trade' },
    { id: 'b1r00001-0000-4000-a000-000000000013', label: 'Branch Code',               type: 'text',   placeholder: '000 (Head Office = 000)' },
    { id: 'b1r00001-0000-4000-a000-000000000014', label: 'Authorized Representative', type: 'text',   placeholder: 'Full name of signatory' },
    { id: 'b1r00001-0000-4000-a000-000000000009', label: 'Company / Registered Name', type: 'text',   placeholder: 'ABC Corporation' },
    { id: 'b1r00001-0000-4000-a000-000000000010', label: 'Last Name',                 type: 'text',   placeholder: 'Dela Cruz' },
    { id: 'b1r00001-0000-4000-a000-000000000011', label: 'First Name',                type: 'text',   placeholder: 'Juan' },
    { id: 'b1r00001-0000-4000-a000-000000000012', label: 'Middle Name',               type: 'text',   placeholder: 'Santos' },
  ];

  var PARTY_FIELDS = [
    { id: 'b1r00002-0000-4000-a000-000000000001', label: 'Taxpayer Type',    type: 'select', options: ['', 'Non-Individual', 'Individual'], labels: ['-- select --', 'Non-Individual / Corporation', 'Individual'] },
    { id: 'b1r00002-0000-4000-a000-000000000002', label: 'TIN',              type: 'text', placeholder: '000-000-000-000' },
    { id: 'b1r00002-0000-4000-a000-000000000003', label: 'Branch Code',      type: 'text', placeholder: '000' },
    { id: 'b1r00002-0000-4000-a000-000000000004', label: 'Company Name',     type: 'text', placeholder: 'Corp / Registered Name' },
    { id: 'b1r00002-0000-4000-a000-000000000005', label: 'Last Name',        type: 'text', placeholder: 'Dela Cruz' },
    { id: 'b1r00002-0000-4000-a000-000000000006', label: 'First Name',       type: 'text', placeholder: 'Juan' },
    { id: 'b1r00002-0000-4000-a000-000000000007', label: 'Middle Name',      type: 'text', placeholder: 'Santos' },
    { id: 'b1r00002-0000-4000-a000-000000000008', label: 'Address Line 1',   type: 'text', placeholder: 'Unit, Bldg, Street, Brgy' },
    { id: 'b1r00002-0000-4000-a000-000000000009', label: 'Address Line 2',   type: 'text', placeholder: 'City / Municipality, Province' },
  ];

  var EMPLOYEE_FIELDS = [
    { id: 'b1r00003-0000-4000-a000-000000000001', label: 'TIN',                     type: 'text', placeholder: '000-000-000-000' },
    { id: 'b1r00003-0000-4000-a000-000000000002', label: 'SSS Number',               type: 'text', placeholder: 'XX-XXXXXXX-X' },
    { id: 'b1r00003-0000-4000-a000-000000000003', label: 'PhilHealth Number',        type: 'text', placeholder: 'XX-XXXXXXXXX-X' },
    { id: 'b1r00003-0000-4000-a000-000000000004', label: 'Pag-IBIG (HDMF) Number',  type: 'text', placeholder: 'XXXX-XXXX-XXXX' },
    { id: 'b1r00003-0000-4000-a000-000000000005', label: 'Employment Status',        type: 'select', options: ['', 'Regular', 'Contractual', 'Probationary', 'Part-time', 'Casual'] },
    { id: 'b1r00003-0000-4000-a000-000000000006', label: 'Tax Status (exemptions)',  type: 'select', options: ['', 'S', 'S1', 'S2', 'S3', 'S4', 'ME', 'ME1', 'ME2', 'ME3', 'ME4'] },
    { id: 'b1r00003-0000-4000-a000-000000000007', label: 'Last Name',                type: 'text', placeholder: 'Dela Cruz' },
    { id: 'b1r00003-0000-4000-a000-000000000008', label: 'First Name',               type: 'text', placeholder: 'Juan' },
    { id: 'b1r00003-0000-4000-a000-000000000009', label: 'Middle Name',              type: 'text', placeholder: 'Santos' },
    { id: 'b1r00003-0000-4000-a000-000000000010', label: 'Date of Birth',            type: 'date' },
    { id: 'b1r00003-0000-4000-a000-000000000011', label: 'Address',                  type: 'text', placeholder: 'Unit, Bldg, Street, Barangay, City' },
  ];

  var PAYSLIP_ITEM_TYPES = [
    { key: 'earnings', label: 'Earnings', endpoint: 'payslip-earnings-item', categories: [
      { id: 'ph-bir-earn-01', name: 'Basic Salary' },
      { id: 'ph-bir-earn-02', name: 'Overtime Pay' },
      { id: 'ph-bir-earn-03', name: 'Holiday Pay' },
      { id: 'ph-bir-earn-04', name: 'Night Differential' },
      { id: 'ph-bir-earn-05', name: 'Hazard Pay' },
      { id: 'ph-bir-earn-06', name: '13th Month Pay (taxable portion)' },
      { id: 'ph-bir-earn-07', name: 'De Minimis Benefits (non-taxable)' },
      { id: 'ph-bir-earn-08', name: 'Other Taxable Allowances' },
      { id: 'ph-bir-earn-09', name: 'Separation Pay / Retirement' },
    ]},
    { key: 'deductions', label: 'Deductions', endpoint: 'payslip-deduction-item', categories: [
      { id: 'ph-bir-ded-01', name: 'Withholding Tax on Compensation' },
      { id: 'ph-bir-ded-02', name: 'SSS Contribution' },
      { id: 'ph-bir-ded-03', name: 'PhilHealth Contribution' },
      { id: 'ph-bir-ded-04', name: 'Pag-IBIG (HDMF) Contribution' },
      { id: 'ph-bir-ded-05', name: 'Other Deductions (non-BIR)' },
    ]},
    { key: 'contributions', label: 'Employer Contributions', endpoint: 'payslip-contribution-item', categories: [
      { id: 'ph-bir-con-01', name: 'SSS - Employer Share' },
      { id: 'ph-bir-con-02', name: 'PhilHealth - Employer Share' },
      { id: 'ph-bir-con-03', name: 'Pag-IBIG - Employer Share' },
    ]},
  ];

  // ---- Helpers ----

  function esc(s) {
    return String(s != null ? s : '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function readCF(model, field) {
    var cf = model && model.customFields;
    if (!cf) return '';
    var v = cf[field.id];
    return v == null ? '' : String(v);
  }

  function patchCF(existing, updates) {
    var out = Object.assign({}, existing || {});
    for (var i = 0; i < updates.length; i++) {
      var f = updates[i].field, v = updates[i].value;
      if (v === '' || v == null) delete out[f.id];
      else out[f.id] = String(v);
    }
    return out;
  }

  function renderControl(field, value, idPfx) {
    var inputId = idPfx + '-' + field.id;
    if (field.type === 'select') {
      var opts = (field.options || []).map(function(o, i) {
        var lbl = field.labels ? field.labels[i] : o;
        var sel = o === value ? ' selected' : '';
        return '<option value="' + esc(o) + '"' + sel + '>' + esc(lbl || o || '--') + '</option>';
      }).join('');
      return '<select id="' + inputId + '" class="form-select" data-cf-id="' + field.id + '">' + opts + '</select>';
    }
    if (field.type === 'date') {
      return '<input id="' + inputId + '" type="date" class="form-input" value="' + esc(value) + '" data-cf-id="' + field.id + '">';
    }
    return '<input id="' + inputId + '" type="text" class="form-input" placeholder="' + esc(field.placeholder || '') + '" value="' + esc(value) + '" data-cf-id="' + field.id + '">';
  }

  function renderField(field, value, idPfx) {
    var ctrl = renderControl(field, value, idPfx);
    var help = field.help ? '<small style="color:#6b7280;font-size:10px;">' + esc(field.help) + '</small>' : '';
    return '<div class="form-group"><label class="form-label">' + esc(field.label) + '</label>' + ctrl + help + '</div>';
  }

  function collectValues(container, fields) {
    return fields.map(function(f) {
      var el = container.querySelector('[data-cf-id="' + f.id + '"]');
      return { field: f, value: el ? el.value : '' };
    });
  }

  function flash(btn, ok) {
    var orig = btn.dataset.orig || btn.textContent;
    btn.dataset.orig = orig;
    btn.disabled = true;
    btn.textContent = ok ? 'Saved' : 'Failed';
    btn.style.background = ok ? '#27ae60' : '#c0392b';
    setTimeout(function() {
      btn.textContent = orig;
      btn.style.background = '';
      btn.disabled = false;
    }, ok ? 1400 : 3000);
  }

  function biz() {
    var sel = document.getElementById('business');
    if (sel && sel.value) return sel.value;
    return (typeof App !== 'undefined' && App.currentBusiness) ? App.currentBusiness : '';
  }

  function noBusinessMsg() {
    return '<div class="alert alert-info">Please select a business above.</div>';
  }

  function spinner(msg) {
    return '<div class="spinner-wrap"><div class="spinner"></div><span>' + esc(msg) + '</span></div>';
  }

  // ---- BUSINESS SECTION ----
  // Mirrors AU extension: data stored IN Manager business record.
  // Form renders immediately with empty fields (no spinner).
  // Loads from Manager in background -- populates form when ready.
  // Switch business -> form clears -> loads new business data from Manager.
  // On save: writes to Manager first, caches to localStorage for reports.

  function mountBusinessSection(container) {
    var currentModel = {};

    function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }

      // Render form immediately with empty fields -- no blocking
      currentModel = {};
      renderBizForm({});

      // Load from Manager in background -- populate when ready
      apiRequest('GET', '/api4/business-details?Business=' + encodeURIComponent(business))
        .then(function(model) {
          if (!model) return;
          currentModel = model;
          var cf = model.customFields || {};
          // Update form fields with Manager data
          BUSINESS_FIELDS.forEach(function(f) {
            var el = container.querySelector('[data-cf-id="' + f.id + '"]');
            if (!el) return;
            el.value = cf[f.id] || '';
          });
          // Update classification toggle
          var cls = cf['b1r00001-0000-4000-a000-000000000004'] || '';
          if (cls) {
            var ind = cls === 'Individual';
            var co = container.querySelector('#cf-grp-company');
            var pi = container.querySelector('#cf-grp-ind');
            if (co) co.style.display = ind ? 'none' : '';
            if (pi) pi.style.display = ind ? '' : 'none';
          }
        })
        .catch(function() {
          // Manager endpoint not available -- form stays empty for now
          // User can fill in and save -- save will attempt Manager write
        });
    }

    function renderBizForm(cf) {
      var isInd = (cf['b1r00001-0000-4000-a000-000000000004'] || '') === 'Individual';

      var left =
        '<p style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:10px;">Taxpayer identity</p>' +
        renderField(BUSINESS_FIELDS[0], cf['b1r00001-0000-4000-a000-000000000001'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[1], cf['b1r00001-0000-4000-a000-000000000002'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[2], cf['b1r00001-0000-4000-a000-000000000003'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[3], cf['b1r00001-0000-4000-a000-000000000004'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[4], cf['b1r00001-0000-4000-a000-000000000005'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[5], cf['b1r00001-0000-4000-a000-000000000013'] || '', 'biz') +
        renderField(BUSINESS_FIELDS[6], cf['b1r00001-0000-4000-a000-000000000014'] || '', 'biz');

      var right =
        '<p style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:10px;">Registered name</p>' +
        '<div id="cf-grp-company" style="' + (isInd ? 'display:none' : '') + '">' +
          renderField(BUSINESS_FIELDS[7], cf['b1r00001-0000-4000-a000-000000000009'] || '', 'biz') +
        '</div>' +
        '<div id="cf-grp-ind" style="' + (!isInd ? 'display:none' : '') + '">' +
          renderField(BUSINESS_FIELDS[8],  cf['b1r00001-0000-4000-a000-000000000010'] || '', 'biz') +
          renderField(BUSINESS_FIELDS[9],  cf['b1r00001-0000-4000-a000-000000000011'] || '', 'biz') +
          renderField(BUSINESS_FIELDS[10], cf['b1r00001-0000-4000-a000-000000000012'] || '', 'biz') +
        '</div>';

      container.innerHTML =
        '<p style="font-size:11px;color:#6b7280;margin-bottom:14px;">' +
        'BIR fields stored as custom fields in Manager -- per business, per record. ' +
        'Used by all reports, DAT files, and 2307 certificate generation.' +
        '</p>' +
        '<form id="cf-biz-form">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
        '<div>' + left + '</div>' +
        '<div>' + right + '</div>' +
        '</div>' +
        '<div style="margin-top:16px;display:flex;justify-content:flex-end;align-items:center;gap:12px;">' +
        '<span id="cf-biz-status" style="font-size:11px;color:#6b7280;"></span>' +
        '<button type="submit" class="btn btn-primary" id="cf-biz-save">Save Business Info</button>' +
        '</div>' +
        '</form>';

      var clsSel = container.querySelector('[data-cf-id="b1r00001-0000-4000-a000-000000000004"]');
      if (clsSel) {
        clsSel.addEventListener('change', function(e) {
          var ind = e.target.value === 'Individual';
          var co = container.querySelector('#cf-grp-company');
          var pi = container.querySelector('#cf-grp-ind');
          if (co) co.style.display = ind ? 'none' : '';
          if (pi) pi.style.display = ind ? '' : 'none';
        });
      }

      container.querySelector('#cf-biz-form').addEventListener('submit', onSave);
    }

    async function onSave(e) {
      e.preventDefault();
      var btn = document.getElementById('cf-biz-save');
      var status = document.getElementById('cf-biz-status');
      var business = biz();
      if (!business) return;
      btn.disabled = true;
      btn.textContent = 'Saving...';
      if (status) status.textContent = '';

      // Collect field values
      var newCF = {};
      BUSINESS_FIELDS.forEach(function(f) {
        var el = container.querySelector('[data-cf-id="' + f.id + '"]');
        if (el) newCF[f.id] = el.value;
      });

      // Build legacy cache for report pages
      var cls   = newCF['b1r00001-0000-4000-a000-000000000004'] || '';
      var isInd = cls === 'Individual';
      var legacyCache = {
        tin:                    newCF['b1r00001-0000-4000-a000-000000000001'] || '',
        rdoCode:                newCF['b1r00001-0000-4000-a000-000000000002'] || '',
        zipCode:                newCF['b1r00001-0000-4000-a000-000000000003'] || '',
        classification:         cls || 'Non-Individual',
        industryClassification: newCF['b1r00001-0000-4000-a000-000000000005'] || '',
        branchCode:             newCF['b1r00001-0000-4000-a000-000000000013'] || '',
        authorizedRep:          newCF['b1r00001-0000-4000-a000-000000000014'] || '',
        companyName:  !isInd ? (newCF['b1r00001-0000-4000-a000-000000000009'] || '') : '',
        lastName:      isInd ? (newCF['b1r00001-0000-4000-a000-000000000010'] || '') : '',
        firstName:     isInd ? (newCF['b1r00001-0000-4000-a000-000000000011'] || '') : '',
        middleName:    isInd ? (newCF['b1r00001-0000-4000-a000-000000000012'] || '') : '',
        taxpayerName:  isInd
          ? [newCF['b1r00001-0000-4000-a000-000000000010'],
             newCF['b1r00001-0000-4000-a000-000000000011'],
             newCF['b1r00001-0000-4000-a000-000000000012']].filter(Boolean).join(', ')
          : (newCF['b1r00001-0000-4000-a000-000000000009'] || ''),
      };

      // Write to Manager -- primary store
      var managerOk = false;
      try {
        var updated = Object.assign({}, currentModel || {});
        updated.customFields = Object.assign({}, (currentModel || {}).customFields || {}, newCF);
        await apiRequest('PUT', '/api4/business-details', { Business: business, Value: updated });
        currentModel = updated;
        managerOk = true;
      } catch(err) {
        console.warn('business-details PUT failed:', err.message);
      }

      // Cache to localStorage for backward compat with report pages
      if (typeof saveSetup === 'function' && typeof getSetup === 'function') {
        var existing = getSetup(business) || {};
        saveSetup(business, Object.assign({}, existing, legacyCache));
      }

      btn.disabled = false;
      btn.textContent = 'Save Business Info';
      if (status) {
        status.textContent = managerOk ? 'Saved to Manager' : 'Saved locally (Manager write failed)';
        status.style.color = managerOk ? '#27ae60' : '#f59e0b';
        setTimeout(function() { if (status) status.textContent = ''; }, 3000);
      }
    }

    return { refresh: refresh };
  }

  // ---- CUSTOMERS / SUPPLIERS SECTION ----

  function mountPartySection(container, partyType) {
    var batchPath = partyType === 'customer' ? '/api4/customer-batch' : '/api4/supplier-batch';
    var putPath   = partyType === 'customer' ? '/api4/customer'       : '/api4/supplier';
    var cache = [];

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading ' + partyType + 's from Manager...');
      try {
        var items = await fetchAllBatch(batchPath, business);
        cache = items.map(function(it) {
          return {
            key: it.key,
            value: it.item || {},
            displayName: (it.item || {}).name || (it.item || {}).Name || it.key,
          };
        }).sort(function(a, b) { return a.displayName.localeCompare(b.displayName); });
      } catch(err) {
        container.innerHTML = '<div class="alert alert-error">Failed: ' + esc(err.message) + '</div>';
        return;
      }
      renderPartyTable();
    }

    function renderPartyTable() {
      if (!cache.length) {
        container.innerHTML = '<div class="alert alert-info">No ' + partyType + 's found.</div>';
        return;
      }
      var dis = 'background:#f1f5f9;color:#94a3b8;';
      var rows = cache.map(function(rec, idx) {
        var cf = rec.value.customFields || {};
        var pType  = cf[PARTY_FIELDS[0].id] || 'Non-Individual';
        var isInd  = pType === 'Individual';
        var tin    = cf[PARTY_FIELDS[1].id] || '';
        var branch = cf[PARTY_FIELDS[2].id] || '';
        var corp   = cf[PARTY_FIELDS[3].id] || '';
        var ln     = cf[PARTY_FIELDS[4].id] || '';
        var fn     = cf[PARTY_FIELDS[5].id] || '';
        var mn     = cf[PARTY_FIELDS[6].id] || '';
        var a1     = cf[PARTY_FIELDS[7].id] || '';
        var a2     = cf[PARTY_FIELDS[8].id] || '';
        return '<tr data-key="' + esc(rec.key) + '" data-idx="' + idx + '">' +
          '<td style="font-weight:600;min-width:140px;font-size:11px;">' + esc(rec.displayName) + '</td>' +
          '<td><select class="form-select cf-ptype" style="width:120px;font-size:10px;" onchange="cfPartyToggle(this)">' +
            '<option value="Non-Individual"' + (!isInd ? ' selected' : '') + '>Non-Individual</option>' +
            '<option value="Individual"' + (isInd ? ' selected' : '') + '>Individual</option>' +
          '</select></td>' +
          '<td><input class="form-input cf-tin"    style="width:115px;font-size:10px;" placeholder="000-000-000-000" value="' + esc(tin) + '"></td>' +
          '<td><input class="form-input cf-branch" style="width:60px;font-size:10px;" placeholder="000" value="' + esc(branch) + '"></td>' +
          '<td><input class="form-input cf-corp" style="width:145px;font-size:10px;" placeholder="Corp/Company" value="' + esc(corp) + '"' + (isInd ? ' disabled style="' + dis + 'width:145px;"' : '') + '></td>' +
          '<td><input class="form-input cf-ln" style="width:95px;font-size:10px;" placeholder="Last" value="' + esc(ln) + '"' + (!isInd ? ' disabled style="' + dis + 'width:95px;"' : '') + '></td>' +
          '<td><input class="form-input cf-fn" style="width:85px;font-size:10px;" placeholder="First" value="' + esc(fn) + '"' + (!isInd ? ' disabled style="' + dis + 'width:85px;"' : '') + '></td>' +
          '<td><input class="form-input cf-mn" style="width:55px;font-size:10px;" placeholder="MI" value="' + esc(mn) + '"' + (!isInd ? ' disabled style="' + dis + 'width:55px;"' : '') + '></td>' +
          '<td><input class="form-input cf-a1" style="width:145px;font-size:10px;" placeholder="Unit, Bldg, Street" value="' + esc(a1) + '"></td>' +
          '<td><input class="form-input cf-a2" style="width:135px;font-size:10px;" placeholder="City, Province" value="' + esc(a2) + '"></td>' +
          '<td><button class="btn btn-primary btn-sm" data-action="cf-save-row" onclick="cfSavePartyRow(this,\'' + partyType + '\')" style="font-size:10px;">Save</button></td>' +
          '</tr>';
      }).join('');

      container.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<input type="text" class="form-input" id="cf-' + partyType + '-search" placeholder="Search..." style="width:200px;" oninput="cfPartySearch(this,\'cf-' + partyType + '-table\')">'+
        '<span style="font-size:11px;color:#6b7280;">' + cache.length + ' records -- Save per row to write to Manager</span>' +
        '<button class="btn" style="margin-left:auto;font-size:11px;padding:5px 12px;border:.5px solid #d1d5db;border-radius:6px;cursor:pointer;" onclick="cfSaveAllParty(\'' + partyType + '\')">Save All</button>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
        '<table class="data-table" id="cf-' + partyType + '-table">' +
        '<thead><tr>' +
        '<th>Name in Manager</th><th>Taxpayer Type</th><th>TIN</th><th>Branch</th>' +
        '<th>Company / Corp Name</th><th>Last Name</th><th>First Name</th><th>MI</th>' +
        '<th>Address 1</th><th>Address 2</th><th></th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div>';
    }

    async function saveRow(btn) {
      var tr = btn.closest('tr');
      var key = tr.dataset.key;
      var idx = parseInt(tr.dataset.idx, 10);
      var business = biz();
      if (!business || !key) return;
      var rec = cache[idx];
      if (!rec) return;
      var pType = tr.querySelector('.cf-ptype').value;
      var isInd = pType === 'Individual';
      var updates = [
        { field: PARTY_FIELDS[0], value: pType },
        { field: PARTY_FIELDS[1], value: tr.querySelector('.cf-tin').value.trim() },
        { field: PARTY_FIELDS[2], value: tr.querySelector('.cf-branch').value.trim() },
        { field: PARTY_FIELDS[3], value: !isInd ? tr.querySelector('.cf-corp').value.trim() : '' },
        { field: PARTY_FIELDS[4], value: isInd ? tr.querySelector('.cf-ln').value.trim() : '' },
        { field: PARTY_FIELDS[5], value: isInd ? tr.querySelector('.cf-fn').value.trim() : '' },
        { field: PARTY_FIELDS[6], value: isInd ? tr.querySelector('.cf-mn').value.trim() : '' },
        { field: PARTY_FIELDS[7], value: tr.querySelector('.cf-a1').value.trim() },
        { field: PARTY_FIELDS[8], value: tr.querySelector('.cf-a2').value.trim() },
      ];
      var updated = Object.assign({}, rec.value, { customFields: patchCF(rec.value.customFields, updates) });
      try {
        await apiRequest('PUT', putPath, { Business: business, Key: key, Value: updated });
        rec.value = updated;
        flash(btn, true);
      } catch(err) {
        console.error(err);
        flash(btn, false);
      }
    }

    async function saveAll() {
      var rows = container.querySelectorAll('tbody tr');
      var ok = 0, fail = 0;
      for (var i = 0; i < rows.length; i++) {
        var saveBtn = rows[i].querySelector('[data-action="cf-save-row"]');
        if (!saveBtn) continue;
        var tr = rows[i];
        var key = tr.dataset.key;
        var idx = parseInt(tr.dataset.idx, 10);
        var business = biz();
        var rec = cache[idx];
        if (!rec || !key || !business) { fail++; continue; }
        try {
          var pType = tr.querySelector('.cf-ptype').value;
          var isInd = pType === 'Individual';
          var updates = [
            { field: PARTY_FIELDS[0], value: pType },
            { field: PARTY_FIELDS[1], value: tr.querySelector('.cf-tin').value.trim() },
            { field: PARTY_FIELDS[2], value: tr.querySelector('.cf-branch').value.trim() },
            { field: PARTY_FIELDS[3], value: !isInd ? tr.querySelector('.cf-corp').value.trim() : '' },
            { field: PARTY_FIELDS[4], value: isInd ? tr.querySelector('.cf-ln').value.trim() : '' },
            { field: PARTY_FIELDS[5], value: isInd ? tr.querySelector('.cf-fn').value.trim() : '' },
            { field: PARTY_FIELDS[6], value: isInd ? tr.querySelector('.cf-mn').value.trim() : '' },
            { field: PARTY_FIELDS[7], value: tr.querySelector('.cf-a1').value.trim() },
            { field: PARTY_FIELDS[8], value: tr.querySelector('.cf-a2').value.trim() },
          ];
          var updated = Object.assign({}, rec.value, { customFields: patchCF(rec.value.customFields, updates) });
          await apiRequest('PUT', putPath, { Business: business, Key: key, Value: updated });
          rec.value = updated;
          ok++;
        } catch(e) { fail++; }
      }
      if (typeof showToast === 'function') {
        showToast(fail === 0 ? (ok + ' ' + partyType + 's saved.') : (ok + ' saved, ' + fail + ' failed.'), fail === 0 ? 'ok' : 'err');
      }
    }

    window['cfSavePartyRow_' + partyType] = function(btn) { saveRow(btn); };
    window['cfSaveAll_' + partyType]      = function()    { saveAll(); };

    return { refresh: refresh };
  }

  // ---- EMPLOYEES SECTION ----

  function mountEmployeeSection(container) {
    var cache = [];

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading employees from Manager...');
      try {
        var items = await fetchAllBatch('/api4/employee-batch', business);
        cache = items.map(function(it) {
          return { key: it.key, value: it.item || {}, displayName: (it.item || {}).name || (it.item || {}).Name || it.key };
        }).sort(function(a, b) { return a.displayName.localeCompare(b.displayName); });
      } catch(err) {
        container.innerHTML = '<div class="alert alert-error">Failed: ' + esc(err.message) + '</div>';
        return;
      }
      renderEmpPicker();
    }

    function renderEmpPicker() {
      if (!cache.length) {
        container.innerHTML = '<div class="alert alert-info">No employees found in this business.</div>';
        return;
      }
      var opts = cache.map(function(e) {
        return '<option value="' + esc(e.key) + '">' + esc(e.displayName) + '</option>';
      }).join('');
      container.innerHTML =
        '<p style="font-size:11px;color:#6b7280;margin-bottom:12px;">BIR fields stored in Manager employee record. Select an employee to edit.</p>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<label style="font-size:12px;color:#6b7280;">Employee</label>' +
        '<select id="cf-emp-picker" style="font-size:12px;min-width:220px;"><option value="">-- select an employee --</option>' + opts + '</select>' +
        '</div><div id="cf-emp-form-host"></div>';
      container.querySelector('#cf-emp-picker').addEventListener('change', function(e) { renderEmpForm(e.target.value); });
    }

    function renderEmpForm(key) {
      var host = container.querySelector('#cf-emp-form-host');
      if (!host) return;
      if (!key) { host.innerHTML = ''; return; }
      var emp = cache.find(function(e) { return e.key === key; });
      if (!emp) return;
      var groups = [
        { heading: 'BIR Identity', fields: EMPLOYEE_FIELDS.slice(0, 4) },
        { heading: 'Employment Details', fields: EMPLOYEE_FIELDS.slice(4, 6) },
        { heading: 'Personal Information', fields: EMPLOYEE_FIELDS.slice(6) },
      ];
      var groupsHtml = groups.map(function(g) {
        return '<fieldset style="border:.5px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:12px;">' +
          '<legend style="font-size:11px;font-weight:500;color:#6b7280;padding:0 6px;">' + esc(g.heading) + '</legend>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          g.fields.map(function(f) { return renderField(f, readCF(emp.value, f), 'emp-' + key); }).join('') +
          '</div></fieldset>';
      }).join('');
      host.innerHTML = '<form id="cf-emp-save-form">' + groupsHtml +
        '<div style="display:flex;justify-content:flex-end;">' +
        '<button type="submit" class="btn btn-primary" id="cf-emp-save-btn">Save employee</button>' +
        '</div></form>';
      host.querySelector('#cf-emp-save-form').addEventListener('submit', function(e) { onEmpSave(e, emp); });
    }

    async function onEmpSave(e, emp) {
      e.preventDefault();
      var business = biz();
      if (!business) return;
      var btn = document.getElementById('cf-emp-save-btn');
      var updates = collectValues(e.currentTarget, EMPLOYEE_FIELDS);
      var updated = Object.assign({}, emp.value, { customFields: patchCF(emp.value.customFields, updates) });
      try {
        await apiRequest('PUT', '/api4/employee', { Business: business, Key: emp.key, Value: updated });
        emp.value = updated;
        flash(btn, true);
      } catch(err) {
        console.error(err);
        flash(btn, false);
      }
    }

    return { refresh: refresh };
  }

  // ---- PAYSLIP ITEMS SECTION ----

  function mountPayslipItemsSection(container) {
    var caches = {};

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading payslip items...');
      try {
        var results = await Promise.all(
          PAYSLIP_ITEM_TYPES.map(function(t) { return fetchAllBatch('/api4/' + t.endpoint + '-batch', business); })
        );
        PAYSLIP_ITEM_TYPES.forEach(function(t, i) {
          caches[t.key] = (results[i] || []).map(function(it) {
            return { key: it.key, value: it.item || {}, displayName: (it.item || {}).name || (it.item || {}).Name || it.key };
          }).sort(function(a, b) { return a.displayName.localeCompare(b.displayName); });
        });
      } catch(err) {
        container.innerHTML = '<div class="alert alert-error">Failed: ' + esc(err.message) + '</div>';
        return;
      }
      renderPayslipTables();
    }

    function renderPayslipTables() {
      var intro = '<p style="font-size:11px;color:#6b7280;margin-bottom:14px;">Assign each payslip item to a BIR reporting category so values flow into 1601C, SAWT, and 2316.</p>';
      container.innerHTML = intro + PAYSLIP_ITEM_TYPES.map(function(type) { return renderPayslipTable(type); }).join('');
      container.querySelectorAll('[data-action="save-payslip-item"]').forEach(function(btn) {
        btn.addEventListener('click', onPayslipSave);
      });
    }

    function renderPayslipTable(type) {
      var items = caches[type.key] || [];
      var heading = '<h3 style="margin:16px 0 6px;font-size:13px;font-weight:500;">' + esc(type.label) + '</h3>';
      if (!items.length) return heading + '<p class="muted">No ' + esc(type.label.toLowerCase()) + ' items in this business.</p>';
      var catOpts = '<option value="">-- none --</option>' +
        type.categories.map(function(c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
      var rows = items.map(function(it, idx) {
        var current = it.value.reportingCategory || '';
        var opts = catOpts.replace('value="' + esc(current) + '"', 'value="' + esc(current) + '" selected');
        return '<tr data-type="' + type.key + '" data-key="' + esc(it.key) + '" data-idx="' + idx + '" style="border-bottom:.5px solid #f3f4f6;">' +
          '<td style="padding:6px 8px;font-size:12px;font-weight:500;">' + esc(it.displayName) + '</td>' +
          '<td style="padding:6px 8px;"><select data-role="cat" style="width:100%;font-size:12px;">' + opts + '</select></td>' +
          '<td style="padding:6px 8px;"><button class="btn btn-primary btn-sm" data-action="save-payslip-item" style="font-size:11px;">Save</button></td>' +
          '</tr>';
      }).join('');
      return heading +
        '<div style="overflow-x:auto;margin-bottom:8px;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="font-size:11px;color:#9ca3af;">' +
        '<th style="text-align:left;padding:5px 8px;font-weight:500;">Item</th>' +
        '<th style="padding:5px 8px;font-weight:500;">BIR Reporting Category</th>' +
        '<th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    }

    async function onPayslipSave(e) {
      var btn = e.currentTarget;
      var row = btn.closest('tr');
      var typeKey = row.dataset.type;
      var type = PAYSLIP_ITEM_TYPES.find(function(t) { return t.key === typeKey; });
      var idx = parseInt(row.dataset.idx, 10);
      var key = row.dataset.key;
      var business = biz();
      if (!business || !type) return;
      var rec = caches[typeKey][idx];
      if (!rec) return;
      var newCat = row.querySelector('[data-role="cat"]').value || null;
      var updated = Object.assign({}, rec.value, { reportingCategory: newCat });
      try {
        await apiRequest('PUT', '/api4/' + type.endpoint, { Business: business, Key: key, Value: updated });
        rec.value = updated;
        flash(btn, true);
      } catch(err) {
        console.error(err);
        flash(btn, false);
      }
    }

    return { refresh: refresh };
  }

  // ---- GLOBAL HELPERS ----

  window.cfPartyToggle = function(sel) {
    var tr = sel.closest('tr');
    var isInd = sel.value === 'Individual';
    var dis = function(cls, disabled) {
      tr.querySelectorAll('.' + cls).forEach(function(inp) {
        inp.disabled = disabled;
        inp.style.background = disabled ? '#f1f5f9' : '';
        inp.style.color = disabled ? '#94a3b8' : '';
        if (disabled) inp.value = '';
      });
    };
    dis('cf-corp', isInd);
    dis('cf-ln', !isInd);
    dis('cf-fn', !isInd);
    dis('cf-mn', !isInd);
  };

  window.cfPartySearch = function(inp, tableId) {
    var q = inp.value.toLowerCase();
    document.querySelectorAll('#' + tableId + ' tbody tr').forEach(function(tr) {
      var name = (tr.querySelector('td:first-child') ? tr.querySelector('td:first-child').textContent : '').toLowerCase();
      tr.style.display = name.indexOf(q) >= 0 ? '' : 'none';
    });
  };

  window.cfSavePartyRow = function(btn, pType) {
    var fn = window['cfSavePartyRow_' + pType];
    if (fn) fn(btn);
  };

  window.cfSaveAllParty = function(pType) {
    var fn = window['cfSaveAll_' + pType];
    if (fn) fn();
  };

  // ---- PUBLIC API ----

  window.CF = {
    mountBusiness:     mountBusinessSection,
    mountParty:        mountPartySection,
    mountEmployees:    mountEmployeeSection,
    mountPayslipItems: mountPayslipItemsSection,
    BUSINESS_FIELDS:   BUSINESS_FIELDS,
    PARTY_FIELDS:      PARTY_FIELDS,
    EMPLOYEE_FIELDS:   EMPLOYEE_FIELDS,
    readCF: readCF,
    readPartyField: function(model, fieldId) {
      var cf = model && model.customFields;
      if (!cf) return '';
      var v = cf[fieldId];
      return v == null ? '' : String(v);
    },
  };

})();
