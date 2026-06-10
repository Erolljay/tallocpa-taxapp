// Custom-field setup for the PH (Philippines BIR) extension.
// Field GUIDs are stable identifiers -- DO NOT CHANGE after first use.
// Uses postMessage bridge (apiRequest from shared.js) -- NOT direct fetch.
//
// Business section mirrors AU extension:
//   - Data stored IN Manager's business record as custom fields
//   - Form renders immediately (no spinner), loads from Manager in background
//   - On save: writes directly to Manager business record (no localStorage)

(function () {

  var BUSINESS_FIELDS = [
    // [0] Identity
    { id: 'b1r00001-0000-4000-a000-000000000001', label: 'TIN',                      type: 'text',   placeholder: '000-000-000-000' },
    { id: 'b1r00001-0000-4000-a000-000000000002', label: 'RDO Code',                 type: 'text',   placeholder: 'e.g. 083' },
    { id: 'b1r00001-0000-4000-a000-000000000013', label: 'Branch Code',              type: 'text',   placeholder: '000 (Head Office = 000)' },
    { id: 'b1r00001-0000-4000-a000-000000000004', label: 'Taxpayer Classification',  type: 'select', options: ['', 'Non-Individual / Corporation', 'Individual'] },
    { id: 'b1r00001-0000-4000-a000-000000000005', label: 'Line of Business',         type: 'text',   placeholder: 'e.g. Retail Trade' },
    { id: 'b1r00001-0000-4000-a000-000000000015', label: 'Telephone Number',         type: 'text',   placeholder: 'e.g. 033-XXX-XXXX' },
    { id: 'b1r00001-0000-4000-a000-000000000016', label: 'Email Address',            type: 'text',   placeholder: 'e.g. info@company.com' },
    // [7] Registered Name (non-individual)
    { id: 'b1r00001-0000-4000-a000-000000000009', label: 'Company / Registered Name', type: 'text',  placeholder: 'ABC Corporation' },
    // [8-10] Registered Name (individual)
    { id: 'b1r00001-0000-4000-a000-000000000010', label: 'Last Name',                type: 'text',   placeholder: 'Dela Cruz' },
    { id: 'b1r00001-0000-4000-a000-000000000011', label: 'First Name',               type: 'text',   placeholder: 'Juan' },
    { id: 'b1r00001-0000-4000-a000-000000000012', label: 'Middle Name',              type: 'text',   placeholder: 'Santos' },
    // [11-16] Address
    { id: 'b1r00001-0000-4000-a000-000000000017', label: 'Substreet',                type: 'text',   placeholder: 'Unit / Floor / Room' },
    { id: 'b1r00001-0000-4000-a000-000000000018', label: 'Street',                   type: 'text',   placeholder: 'e.g. Iznart St.' },
    { id: 'b1r00001-0000-4000-a000-000000000019', label: 'Barangay',                 type: 'text',   placeholder: 'e.g. Brgy. Rizal' },
    { id: 'b1r00001-0000-4000-a000-000000000020', label: 'District / Municipality',  type: 'text',   placeholder: 'e.g. Iloilo City' },
    { id: 'b1r00001-0000-4000-a000-000000000021', label: 'City / Province',          type: 'text',   placeholder: 'e.g. Iloilo' },
    { id: 'b1r00001-0000-4000-a000-000000000003', label: 'Zip Code',                 type: 'text',   placeholder: 'e.g. 5000' },
    // [17-18] Authorized Rep
    { id: 'b1r00001-0000-4000-a000-000000000014', label: 'Authorized Rep Name',      type: 'text',   placeholder: 'Full name of signatory' },
    { id: 'b1r00001-0000-4000-a000-000000000022', label: 'Authorized Rep Title',     type: 'text',   placeholder: 'e.g. President / Treasurer' },
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

  function mountBusinessSection(container) {
    var currentModel = {};
    var birGuids = null;

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }

      currentModel = {};
      renderBizForm({});

      var statusEl = container.querySelector('#cf-biz-status');
      if (statusEl) { statusEl.textContent = 'Loading...'; statusEl.style.color = '#6b7280'; }

      try {
        birGuids = await ensureBIRFields(business);

        var model = await apiRequest('GET', '/api4/business-details?business=' + encodeURIComponent(business));
        if (statusEl) statusEl.textContent = '';
        if (!model) return;
        currentModel = model;

        // BIR data lives in customFields2.strings keyed by the real Manager GUID
        var cf = parseBIRBlob((model.customFields2 && model.customFields2.strings) || {}, birGuids && birGuids.biz, 'b1r00001-');

        BUSINESS_FIELDS.forEach(function(f) {
          var el = container.querySelector('[data-cf-id="' + f.id + '"]');
          if (!el) return;
          el.value = cf[f.id] || '';
        });
        var cls = cf['b1r00001-0000-4000-a000-000000000004'] || '';
        var ind = cls === 'Individual';
        var co = container.querySelector('#cf-grp-company');
        var pi = container.querySelector('#cf-grp-ind');
        if (co) co.style.display = ind ? 'none' : '';
        if (pi) pi.style.display = ind ? '' : 'none';
      } catch(err) {
        if (statusEl) {
          statusEl.textContent = 'Could not load from Manager — fill in and save manually.';
          statusEl.style.color = '#f59e0b';
        }
        console.warn('business-details GET failed:', err && err.message);
      }
    }

    function renderBizForm(cf) {
      var isInd = (cf['b1r00001-0000-4000-a000-000000000004'] || '') === 'Individual';

      function BF(id) { return BUSINESS_FIELDS.find(function(f){ return f.id === id; }); }
      function val(id) { return cf[id] || ''; }

      var secStyle = 'font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;';

      var left =
        '<p style="' + secStyle + '">Taxpayer Identity</p>' +
        renderField(BF('b1r00001-0000-4000-a000-000000000001'), val('b1r00001-0000-4000-a000-000000000001'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000002'), val('b1r00001-0000-4000-a000-000000000002'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000013'), val('b1r00001-0000-4000-a000-000000000013'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000004'), val('b1r00001-0000-4000-a000-000000000004'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000005'), val('b1r00001-0000-4000-a000-000000000005'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000015'), val('b1r00001-0000-4000-a000-000000000015'), 'biz') +
        renderField(BF('b1r00001-0000-4000-a000-000000000016'), val('b1r00001-0000-4000-a000-000000000016'), 'biz');

      var right =
        '<p style="' + secStyle + '">Registered Name</p>' +
        '<div id="cf-grp-company" style="' + (isInd ? 'display:none' : '') + '">' +
          renderField(BF('b1r00001-0000-4000-a000-000000000009'), val('b1r00001-0000-4000-a000-000000000009'), 'biz') +
        '</div>' +
        '<div id="cf-grp-ind" style="' + (!isInd ? 'display:none' : '') + '">' +
          renderField(BF('b1r00001-0000-4000-a000-000000000010'), val('b1r00001-0000-4000-a000-000000000010'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000011'), val('b1r00001-0000-4000-a000-000000000011'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000012'), val('b1r00001-0000-4000-a000-000000000012'), 'biz') +
        '</div>';

      var addr =
        '<p style="' + secStyle + 'margin-top:16px;">Address</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 16px;">' +
          renderField(BF('b1r00001-0000-4000-a000-000000000017'), val('b1r00001-0000-4000-a000-000000000017'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000018'), val('b1r00001-0000-4000-a000-000000000018'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000019'), val('b1r00001-0000-4000-a000-000000000019'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000020'), val('b1r00001-0000-4000-a000-000000000020'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000021'), val('b1r00001-0000-4000-a000-000000000021'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000003'), val('b1r00001-0000-4000-a000-000000000003'), 'biz') +
        '</div>';

      var rep =
        '<p style="' + secStyle + 'margin-top:16px;">Authorized Representative</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;">' +
          renderField(BF('b1r00001-0000-4000-a000-000000000014'), val('b1r00001-0000-4000-a000-000000000014'), 'biz') +
          renderField(BF('b1r00001-0000-4000-a000-000000000022'), val('b1r00001-0000-4000-a000-000000000022'), 'biz') +
        '</div>';

      container.innerHTML =
        '<p style="font-size:11px;color:#6b7280;margin-bottom:14px;">' +
        'BIR fields stored as custom fields in Manager — per business, per record. ' +
        'Used by all reports, DAT files, and 2307 certificate generation.' +
        '</p>' +
        '<form id="cf-biz-form">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
        '<div>' + left + '</div>' +
        '<div>' + right + '</div>' +
        '</div>' +
        addr +
        rep +
        '<div style="margin-top:16px;display:flex;justify-content:flex-end;align-items:center;gap:12px;">' +
        '<span id="cf-biz-status" style="font-size:11px;color:#6b7280;"></span>' +
        '<button type="button" id="cf-biz-reload" class="btn btn-secondary" style="font-size:12px;">Reload</button>' +
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

      container.querySelector('#cf-biz-reload').addEventListener('click', function() { refresh(); });
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

      var birBlob = {};
      BUSINESS_FIELDS.forEach(function(f) {
        var el = container.querySelector('[data-cf-id="' + f.id + '"]');
        if (el) birBlob[f.id] = el.value || '';
      });

      var managerOk = false;
      try {
        if (!birGuids) birGuids = await ensureBIRFields(business);
        if (!birGuids || !birGuids.biz) throw new Error('BIR custom field not ready');
        var managerCF2 = buildBIRCustomFields(currentModel, birGuids.biz, birBlob);
        var bizValue = {
          name:          (currentModel || {}).name    || null,
          address:       (currentModel || {}).address || null,
          customFields2: managerCF2,
        };
        await apiRequest('PUT', `/api4/business-details?business=${encodeURIComponent(business)}`, { value: bizValue });
        currentModel = Object.assign({}, currentModel || {}, { customFields2: managerCF2 });
        managerOk = true;
      } catch(err) {
        console.warn('business-details PUT failed:', err.message);
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

  function buildSafeValue(v, overrides) {
    var result = {};
    Object.keys(v || {}).forEach(function(k) {
      if (k === 'timestamp' || k === 'id' || k === 'key') return;
      result[k] = v[k];
    });
    return Object.assign(result, overrides || {});
  }

  function buildPartyValue(v, newCustomFields2) {
    return {
      name:            v.name            !== undefined ? v.name            : null,
      code:            v.code            !== undefined ? v.code            : null,
      creditLimit:     v.creditLimit     !== undefined ? v.creditLimit     : 0,
      currency:        v.currency        !== undefined ? v.currency        : null,
      billingAddress:  v.billingAddress  !== undefined ? v.billingAddress  : null,
      deliveryAddress: v.deliveryAddress !== undefined ? v.deliveryAddress : null,
      email:           v.email           !== undefined ? v.email           : null,
      division:        v.division        !== undefined ? v.division        : null,
      controlAccount:  v.controlAccount  !== undefined ? v.controlAccount  : null,
      hasDefaultDueDateDays: v.hasDefaultDueDateDays || false,
      defaultDueDateDays:    v.defaultDueDateDays    !== undefined ? v.defaultDueDateDays : null,
      hasDefaultHourlyRate:  v.hasDefaultHourlyRate  || false,
      defaultHourlyRate:     v.defaultHourlyRate     !== undefined ? v.defaultHourlyRate  : 0,
      inactive:              v.inactive              || false,
      customFields:          v.customFields          !== undefined ? v.customFields : null,
      customFields2:         newCustomFields2,
      hasDefaultBillingAddress:  v.hasDefaultBillingAddress  || false,
      defaultBillingAddress:     v.defaultBillingAddress     !== undefined ? v.defaultBillingAddress  : null,
      hasDefaultDeliveryAddress: v.hasDefaultDeliveryAddress || false,
      defaultDeliveryAddress:    v.defaultDeliveryAddress    !== undefined ? v.defaultDeliveryAddress : null,
    };
  }

  function mountPartySection(container, partyType) {
    var batchPath = partyType === 'customer' ? '/api4/customer-batch' : '/api4/supplier-batch';
    var putPath   = partyType === 'customer' ? '/api4/customer'       : '/api4/supplier';
    var cache = [];
    var birGuids = null;

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading ' + partyType + 's from Manager…');
      try {
        birGuids = await ensureBIRFields(business);
        var res = await apiRequest('GET', batchPath + '?business=' + encodeURIComponent(business) + '&Skip=0&PageSize=500');
        var items = (res && res.items) ? res.items : [];
        cache = items.map(function(it) {
          return {
            key: it.key,
            value: it.item || {},
            displayName: (it.item || {}).name || (it.item || {}).Name || it.key,
          };
        }).sort(function(a, b) { return a.displayName.localeCompare(b.displayName); });
      } catch(err) {
        container.innerHTML =
          '<div style="padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:12px;color:#991b1b;">' +
          '⚠ Could not load ' + partyType + 's: ' + esc(err.message) +
          ' <button onclick="CF.mount' + (partyType === 'customer' ? 'Party' : 'Party') + '" style="margin-left:8px;font-size:11px;padding:2px 10px;cursor:pointer;" id="cf-' + partyType + '-retry">Retry</button>' +
          '</div>';
        var retryBtn = container.querySelector('#cf-' + partyType + '-retry');
        if (retryBtn) retryBtn.addEventListener('click', function() { refresh(); });
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
        var cf = parseBIRBlob((rec.value.customFields2 && rec.value.customFields2.strings) || {}, birGuids && birGuids.party, 'b1r00002-');
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
          '<td><input class="form-input cf-tin"    style="width:120px;font-size:11px;" placeholder="000-000-000-000" value="' + esc(tin) + '"></td>' +
          '<td><input class="form-input cf-branch" style="width:60px;font-size:11px;" placeholder="000" value="' + esc(branch) + '"></td>' +
          '<td><input class="form-input cf-corp" style="width:150px;font-size:11px;" placeholder="Corp / Registered Name" value="' + esc(corp) + '"' + (isInd ? ' disabled style="' + dis + 'width:150px;font-size:11px;"' : '') + '></td>' +
          '<td><input class="form-input cf-ln" style="width:100px;font-size:11px;" placeholder="Dela Cruz" value="' + esc(ln) + '"' + (!isInd ? ' disabled style="' + dis + 'width:100px;font-size:11px;"' : '') + '></td>' +
          '<td><input class="form-input cf-fn" style="width:90px;font-size:11px;" placeholder="Juan" value="' + esc(fn) + '"' + (!isInd ? ' disabled style="' + dis + 'width:90px;font-size:11px;"' : '') + '></td>' +
          '<td><input class="form-input cf-mn" style="width:60px;font-size:11px;" placeholder="Santos" value="' + esc(mn) + '"' + (!isInd ? ' disabled style="' + dis + 'width:60px;font-size:11px;"' : '') + '></td>' +
          '<td><input class="form-input cf-a1" style="width:170px;font-size:11px;" placeholder="Unit, Bldg, Street, Brgy" value="' + esc(a1) + '"></td>' +
          '<td><input class="form-input cf-a2" style="width:150px;font-size:11px;" placeholder="City / Municipality, Province" value="' + esc(a2) + '"></td>' +
          '<td><button class="btn btn-primary btn-sm" data-action="cf-save-row" onclick="cfSavePartyRow(this,\'' + partyType + '\')" style="font-size:10px;">Save</button></td>' +
          '</tr>';
      }).join('');

      container.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<input type="text" class="form-input" id="cf-' + partyType + '-search" placeholder="Search by name…" style="width:220px;" oninput="cfPartySearch(this,\'cf-' + partyType + '-table\')">'+
        '<span style="font-size:11px;color:#6b7280;">' + cache.length + ' record' + (cache.length !== 1 ? 's' : '') + ' — Save per row or use Save All</span>' +
        '<button class="btn btn-secondary" style="margin-left:auto;font-size:11px;padding:5px 14px;" onclick="cfSaveAllParty(\'' + partyType + '\')">Save All</button>' +
        '</div>' +
        '<div style="overflow-x:auto;width:100%;">' +
        '<table class="data-table" id="cf-' + partyType + '-table" style="min-width:1300px;width:100%;border-collapse:collapse;">' +
        '<thead><tr style="font-size:11px;white-space:nowrap;">' +
        '<th style="min-width:160px;">Name in Manager</th>' +
        '<th style="min-width:130px;">Taxpayer Type</th>' +
        '<th style="min-width:130px;">TIN</th>' +
        '<th style="min-width:70px;">Branch</th>' +
        '<th style="min-width:160px;">Company / Corp Name</th>' +
        '<th style="min-width:110px;">Last Name</th>' +
        '<th style="min-width:100px;">First Name</th>' +
        '<th style="min-width:70px;">Middle Name</th>' +
        '<th style="min-width:180px;">Address Line 1</th>' +
        '<th style="min-width:160px;">Address Line 2</th>' +
        '<th style="min-width:60px;"></th>' +
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
      // Patch the BIR blob, then wrap in Manager customFields2
      var existingBlob = parseBIRBlob((rec.value.customFields2 && rec.value.customFields2.strings) || {}, birGuids && birGuids.party, 'b1r00002-');
      var newBlob  = patchCF(existingBlob, updates);
      var managerCF2 = buildBIRCustomFields(rec.value, birGuids && birGuids.party, newBlob);
      var putValue = buildPartyValue(rec.value, managerCF2);
      try {
        await apiRequest('PUT', putPath, { business: business, key: key, value: putValue });
        rec.value = Object.assign({}, rec.value, { customFields2: managerCF2 });
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
          var existingBlob = parseBIRBlob((rec.value.customFields2 && rec.value.customFields2.strings) || {}, birGuids && birGuids.party, 'b1r00002-');
          var newBlob   = patchCF(existingBlob, updates);
          var managerCF2 = buildBIRCustomFields(rec.value, birGuids && birGuids.party, newBlob);
          var putValue  = buildPartyValue(rec.value, managerCF2);
          await apiRequest('PUT', putPath, { business: business, key: key, value: putValue });
          rec.value = Object.assign({}, rec.value, { customFields2: managerCF2 });
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
    var birGuids = null;

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading employees from Manager…');
      birGuids = await ensureBIRFields(business);
      try {
        var res = await apiRequest('GET', '/api4/employee-batch?business=' + encodeURIComponent(business) + '&Skip=0&PageSize=500');
        var items = (res && res.items) ? res.items : [];
        cache = items.map(function(it) {
          return { key: it.key, value: it.item || {}, displayName: (it.item || {}).name || (it.item || {}).Name || it.key };
        }).sort(function(a, b) { return a.displayName.localeCompare(b.displayName); });
      } catch(err) {
        container.innerHTML =
          '<div style="padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:12px;color:#991b1b;">' +
          '⚠ Could not load employees: ' + esc(err.message) +
          ' <button id="cf-emp-retry" style="margin-left:8px;font-size:11px;padding:2px 10px;cursor:pointer;">Retry</button></div>';
        var retryBtn = container.querySelector('#cf-emp-retry');
        if (retryBtn) retryBtn.addEventListener('click', function() { refresh(); });
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
      var empBlob = parseBIRBlob((emp.value.customFields2 && emp.value.customFields2.strings) || {}, birGuids && birGuids.emp, 'b1r00003-');
      var groups = [
        { heading: 'BIR Identity', fields: EMPLOYEE_FIELDS.slice(0, 4) },
        { heading: 'Employment Details', fields: EMPLOYEE_FIELDS.slice(4, 6) },
        { heading: 'Personal Information', fields: EMPLOYEE_FIELDS.slice(6) },
      ];
      var groupsHtml = groups.map(function(g) {
        return '<fieldset style="border:.5px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:12px;">' +
          '<legend style="font-size:11px;font-weight:500;color:#6b7280;padding:0 6px;">' + esc(g.heading) + '</legend>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          g.fields.map(function(f) { return renderField(f, empBlob[f.id] || '', 'emp-' + key); }).join('') +
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
      var existingBlob = parseBIRBlob((emp.value.customFields2 && emp.value.customFields2.strings) || {}, birGuids && birGuids.emp, 'b1r00003-');
      var newBlob   = patchCF(existingBlob, updates);
      var managerCF2 = buildBIRCustomFields(emp.value, birGuids && birGuids.emp, newBlob);
      var updated   = buildSafeValue(emp.value, { customFields2: managerCF2 });
      try {
        await apiRequest('PUT', '/api4/employee', { business: business, key: emp.key, value: updated });
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
      var updated = buildSafeValue(rec.value, { reportingCategory: newCat });
      try {
        await apiRequest('PUT', '/api4/' + type.endpoint, { business: business, key: key, value: updated });
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
