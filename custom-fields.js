// Custom-field setup for the PH (Philippines BIR) extension.
// Mirrors the AU extension pattern: fields are stored as a flat string
// dictionary (customFields: { guid: value }) on Business, Customer, and
// Supplier records — no server-side metadata creation required.
//
// Field GUIDs are stable per-field identifiers hardcoded here.
// Wire format: GET → item.customFields[guid], PUT body → { Business, Key, Value }
//
// All API calls use the postMessage bridge (apiRequest) — NOT direct fetch().
// Requires: shared.js loaded first (provides apiRequest, escHtml, fetchAllBatch).

(function () {

  // ── BIR FIELD GUID REGISTRY ───────────────────────────────────────────────
  // DO NOT CHANGE these GUIDs after first use — they are the stable keys in
  // Manager's customFields bag. New fields get new GUIDs.

  const BUSINESS_FIELDS = [
    { id: 'b1r00001-0000-4000-a000-000000000001', label: 'TIN',                       type: 'text',   placeholder: '000-000-000-000' },
    { id: 'b1r00001-0000-4000-a000-000000000002', label: 'RDO Code',                  type: 'text',   placeholder: 'e.g. 083' },
    { id: 'b1r00001-0000-4000-a000-000000000003', label: 'Zip Code',                  type: 'text',   placeholder: 'e.g. 5000' },
    { id: 'b1r00001-0000-4000-a000-000000000004', label: 'Taxpayer Classification',   type: 'select',
      options: ['', 'Non-Individual / Corporation', 'Individual'] },
    { id: 'b1r00001-0000-4000-a000-000000000005', label: 'Industry Classification',   type: 'text',   placeholder: 'e.g. Retail Trade' },
    { id: 'b1r00001-0000-4000-a000-000000000013', label: 'Branch Code',               type: 'text',   placeholder: '000 (Head Office = 000)' },
    { id: 'b1r00001-0000-4000-a000-000000000014', label: 'Authorized Representative', type: 'text',   placeholder: 'Full name of signatory' },
    { id: 'b1r00001-0000-4000-a000-000000000009', label: 'Company / Registered Name', type: 'text',   placeholder: 'ABC Corporation' },
    { id: 'b1r00001-0000-4000-a000-000000000010', label: 'Last Name',                 type: 'text',   placeholder: 'Dela Cruz' },
    { id: 'b1r00001-0000-4000-a000-000000000011', label: 'First Name',                type: 'text',   placeholder: 'Juan' },
    { id: 'b1r00001-0000-4000-a000-000000000012', label: 'Middle Name',               type: 'text',   placeholder: 'Santos' },
  ];

  const PARTY_FIELDS = [
    { id: 'b1r00002-0000-4000-a000-000000000001', label: 'Taxpayer Type',   type: 'select',
      options: ['', 'Non-Individual', 'Individual'],
      labels:  ['— select —', 'Non-Individual / Corporation', 'Individual'] },
    { id: 'b1r00002-0000-4000-a000-000000000002', label: 'TIN',            type: 'text',  placeholder: '000-000-000-000' },
    { id: 'b1r00002-0000-4000-a000-000000000003', label: 'Branch Code',    type: 'text',  placeholder: '000' },
    { id: 'b1r00002-0000-4000-a000-000000000004', label: 'Company Name',   type: 'text',  placeholder: 'Corp / Registered Name' },
    { id: 'b1r00002-0000-4000-a000-000000000005', label: 'Last Name',      type: 'text',  placeholder: 'Dela Cruz' },
    { id: 'b1r00002-0000-4000-a000-000000000006', label: 'First Name',     type: 'text',  placeholder: 'Juan' },
    { id: 'b1r00002-0000-4000-a000-000000000007', label: 'Middle Name',    type: 'text',  placeholder: 'Santos' },
    { id: 'b1r00002-0000-4000-a000-000000000008', label: 'Address Line 1', type: 'text',  placeholder: 'Unit, Bldg, Street, Brgy' },
    { id: 'b1r00002-0000-4000-a000-000000000009', label: 'Address Line 2', type: 'text',  placeholder: 'City / Municipality, Province' },
  ];

  // Convenience lookup: read a customField value from a model object
  function readCF(model, field) {
    const cf = model && model.customFields;
    if (!cf) return '';
    const v = cf[field.id];
    return v == null ? '' : String(v);
  }

  // Merge updated values back into the existing customFields dict
  function patchCF(existing, updates) {
    const out = Object.assign({}, existing || {});
    for (const { field, value } of updates) {
      if (value === '' || value == null) delete out[field.id];
      else out[field.id] = String(value);
    }
    return out;
  }

  // ── HTML HELPERS ───────────────────────────────────────────────────────────

  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function renderControl(field, value, idPfx) {
    const inputId = `${idPfx}-${field.id}`;
    if (field.type === 'select') {
      const opts = (field.options || []).map((o, i) => {
        const lbl = field.labels ? field.labels[i] : o;
        const sel = o === value ? ' selected' : '';
        return `<option value="${esc(o)}"${sel}>${esc(lbl || o || '—')}</option>`;
      }).join('');
      return `<select id="${inputId}" class="form-select" data-cf-id="${field.id}">${opts}</select>`;
    }
    return `<input id="${inputId}" type="text" class="form-input"
      placeholder="${esc(field.placeholder || '')}"
      value="${esc(value)}" data-cf-id="${field.id}">`;
  }

  function renderField(field, value, idPfx) {
    const ctrl = renderControl(field, value, idPfx);
    const help = field.help ? `<small style="color:#6b7280;font-size:10px;">${esc(field.help)}</small>` : '';
    return `<div class="form-group">
      <label class="form-label">${esc(field.label)}</label>
      ${ctrl}${help}
    </div>`;
  }

  function collectValues(container, fields) {
    return fields.map(f => {
      const el = container.querySelector(`[data-cf-id="${f.id}"]`);
      return { field: f, value: el ? el.value : '' };
    });
  }

  function flash(btn, ok) {
    const orig = btn.dataset.orig || btn.textContent;
    btn.dataset.orig = orig;
    btn.disabled = true;
    btn.textContent = ok ? '✅ Saved' : '❌ Failed';
    btn.style.background = ok ? '#27ae60' : '#c0392b';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.disabled = false;
    }, ok ? 1400 : 3000);
  }

  // Helper: get current business — reads businessSelect directly (new app.js pattern)
  function biz() {
    var sel = document.getElementById('business');
    if (sel && sel.value) return sel.value;
    return (typeof App !== 'undefined' && App.currentBusiness) ? App.currentBusiness : '';
  }

  // ── SECTION: BUSINESS INFO ─────────────────────────────────────────────────
  // Reads/writes directly from Manager's business-details customFields.
  // Falls back to localStorage (getSetup) for display while loading.

  function mountBusinessSection(container) {
    let model = {};

    async function refresh() {
      const business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading business info…');
      try {
        // Try Manager first; fall back gracefully if endpoint is unavailable
        const res = await apiRequest('GET', `/api4/business-details?Business=${encodeURIComponent(business)}`);
        model = res || {};
      } catch (_) {
        // Endpoint not available — start with empty model (we'll still write on save)
        model = {};
      }
      // Merge in any locally-cached values as defaults for fields not yet in Manager
      const local = (typeof getSetup === 'function' && getSetup(business)) || {};
      mergeLocalIntoModel(model, local);
      render();
    }

    // Pre-populate customFields from legacy localStorage values so the form
    // doesn't appear blank on first use after migration.
    function mergeLocalIntoModel(m, local) {
      const map = {
        'b1r00001-0000-4000-a000-000000000001': local.tin,
        'b1r00001-0000-4000-a000-000000000002': local.rdoCode,
        'b1r00001-0000-4000-a000-000000000003': local.zipCode,
        'b1r00001-0000-4000-a000-000000000004': local.classification === 'Individual' ? 'Individual' : (local.classification || ''),
        'b1r00001-0000-4000-a000-000000000005': local.industryClassification,
        'b1r00001-0000-4000-a000-000000000006': local.salesTaxType,
        'b1r00001-0000-4000-a000-000000000007': local.incomeTaxType,
        'b1r00001-0000-4000-a000-000000000008': (local.withholdingTypes || []).join(','),
        'b1r00001-0000-4000-a000-000000000009': local.companyName,
        'b1r00001-0000-4000-a000-000000000010': local.lastName,
        'b1r00001-0000-4000-a000-000000000011': local.firstName,
        'b1r00001-0000-4000-a000-000000000012': local.middleName,
      };
      m.customFields = m.customFields || {};
      for (const [guid, val] of Object.entries(map)) {
        if (val && !m.customFields[guid]) m.customFields[guid] = String(val);
      }
    }

    function render() {
      const vals = {};
      BUSINESS_FIELDS.forEach(f => { vals[f.id] = readCF(model, f); });
      const isInd = vals['b1r00001-0000-4000-a000-000000000004'] === 'Individual';

      container.innerHTML = `
        <p style="font-size:11px;color:#6b7280;margin-bottom:14px;">
          BIR fields are stored directly in Manager's Business Details record.
          Standard fields (Name, Address) are set in Manager itself.
        </p>
        <form id="cf-biz-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <div class="card-title">Taxpayer Identity</div>
              <div class="form-grid">
                ${renderField(BUSINESS_FIELDS[0], vals['b1r00001-0000-4000-a000-000000000001'], 'biz')}
                ${renderField(BUSINESS_FIELDS[1], vals['b1r00001-0000-4000-a000-000000000002'], 'biz')}
                ${renderField(BUSINESS_FIELDS[2], vals['b1r00001-0000-4000-a000-000000000003'], 'biz')}
                ${renderField(BUSINESS_FIELDS[3], vals['b1r00001-0000-4000-a000-000000000004'], 'biz')}
                <div id="cf-grp-company" style="${isInd?'display:none':''}" class="form-group">
                  <label class="form-label">Company / Registered Name</label>
                  <input class="form-input" data-cf-id="b1r00001-0000-4000-a000-000000000009"
                    placeholder="ABC Corporation" value="${esc(vals['b1r00001-0000-4000-a000-000000000009'])}">
                </div>
                <div id="cf-grp-ln" style="${!isInd?'display:none':''}">
                  ${renderField(BUSINESS_FIELDS[9],  vals['b1r00001-0000-4000-a000-000000000010'], 'biz')}
                </div>
                <div id="cf-grp-fn" style="${!isInd?'display:none':''}">
                  ${renderField(BUSINESS_FIELDS[10], vals['b1r00001-0000-4000-a000-000000000011'], 'biz')}
                </div>
                <div id="cf-grp-mn" style="${!isInd?'display:none':''}">
                  ${renderField(BUSINESS_FIELDS[11], vals['b1r00001-0000-4000-a000-000000000012'], 'biz')}
                </div>
              </div>
            </div>
            <div>
              <div class="card-title">Filing Information</div>
              <div class="form-grid">
                ${renderField(BUSINESS_FIELDS[4], vals['b1r00001-0000-4000-a000-000000000005'], 'biz')}
                ${renderField(BUSINESS_FIELDS[5], vals['b1r00001-0000-4000-a000-000000000006'], 'biz')}
                <div id="cf-income-row" style="${!isInd?'display:none':''}">
                  ${renderField(BUSINESS_FIELDS[6], vals['b1r00001-0000-4000-a000-000000000007'], 'biz')}
                </div>
                ${renderField(BUSINESS_FIELDS[7], vals['b1r00001-0000-4000-a000-000000000008'], 'biz')}
              </div>
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" id="cf-biz-save">💾 Save Business Info</button>
          </div>
        </form>`;

      // Toggle individual/corp name fields on classification change
      container.querySelector('[data-cf-id="b1r00001-0000-4000-a000-000000000004"]')
        ?.addEventListener('change', e => toggleBizNameFields(container, e.target.value));

      container.querySelector('#cf-biz-form').addEventListener('submit', onSave);
    }

    function toggleBizNameFields(container, val) {
      const isInd = val === 'Individual';
      const show = (id, v) => { const el = container.querySelector(`#${id}`); if (el) el.style.display = v ? '' : 'none'; };
      show('cf-grp-company', !isInd);
      show('cf-grp-ln',  isInd);
      show('cf-grp-fn',  isInd);
      show('cf-grp-mn',  isInd);
      show('cf-income-row', isInd);
    }

    async function onSave(e) {
      e.preventDefault();
      const btn = document.getElementById('cf-biz-save');
      const business = biz();
      if (!business) return;

      const updates = collectValues(container, BUSINESS_FIELDS);
      const updated = Object.assign({}, model, {
        customFields: patchCF(model.customFields, updates),
      });

      try {
        await apiRequest('PUT', '/api4/business-details', { Business: business, Value: updated });
        model = updated;
        // Also persist to localStorage for legacy report pages that still read from it
        syncToLocalStorage(business, updated.customFields);
        flash(btn, true);
      } catch (err) {
        console.error(err);
        // Fallback: save to localStorage only
        syncToLocalStorage(business, patchCF(model.customFields, updates));
        flash(btn, false);
        if (typeof showToast === 'function') showToast('⚠️ Manager write failed — saved locally only.', 'err');
      }
    }

    // Keep localStorage in sync so existing report pages (2550Q, SLS, etc.) can
    // still read setup fields via getSetup() without needing full migration.
    function syncToLocalStorage(business, cf) {
      if (typeof getSetup !== 'function' || typeof saveSetup !== 'function') return;
      const existing = getSetup(business) || {};
      const wt = (cf['b1r00001-0000-4000-a000-000000000008'] || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      const cls = cf['b1r00001-0000-4000-a000-000000000004'] || '';
      const isInd = cls === 'Individual';
      saveSetup(business, {
        ...existing,
        tin:                    cf['b1r00001-0000-4000-a000-000000000001'] || '',
        rdoCode:                cf['b1r00001-0000-4000-a000-000000000002'] || '',
        zipCode:                cf['b1r00001-0000-4000-a000-000000000003'] || '',
        classification:         cls || 'Non-Individual',
        industryClassification: cf['b1r00001-0000-4000-a000-000000000005'] || '',
        salesTaxType:           cf['b1r00001-0000-4000-a000-000000000006'] || 'none',
        incomeTaxType:          cf['b1r00001-0000-4000-a000-000000000007'] || 'graduated',
        withholdingTypes:       wt,
        companyName:            !isInd ? (cf['b1r00001-0000-4000-a000-000000000009'] || '') : '',
        lastName:               isInd  ? (cf['b1r00001-0000-4000-a000-000000000010'] || '') : '',
        firstName:              isInd  ? (cf['b1r00001-0000-4000-a000-000000000011'] || '') : '',
        middleName:             isInd  ? (cf['b1r00001-0000-4000-a000-000000000012'] || '') : '',
        taxpayerName:           isInd
          ? [cf['b1r00001-0000-4000-a000-000000000010'], cf['b1r00001-0000-4000-a000-000000000011'], cf['b1r00001-0000-4000-a000-000000000012']].filter(Boolean).join(', ')
          : (cf['b1r00001-0000-4000-a000-000000000009'] || ''),
      });
    }

    return { refresh };
  }

  // ── SECTION: CUSTOMERS / SUPPLIERS (table with per-row save) ──────────────

  function mountPartySection(container, partyType) {
    // partyType: 'customer' or 'supplier'
    const batchPath  = partyType === 'customer' ? '/api4/customer-batch' : '/api4/supplier-batch';
    const putPath    = partyType === 'customer' ? '/api4/customer'       : '/api4/supplier';
    let cache = []; // [{ key, value: { Name, customFields, ... } }]

    async function refresh() {
      const business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner(`Loading ${partyType}s from Manager…`);
      try {
        const items = await fetchAllBatch(batchPath, business);
        cache = items
          .map(it => ({ key: it.key, value: it.item || {} }))
          .sort((a, b) => (a.value.Name || '').localeCompare(b.value.Name || ''));
      } catch (err) {
        container.innerHTML = `<div class="alert alert-error">❌ ${esc(err.message)}</div>`;
        return;
      }
      render();
    }

    function render() {
      if (cache.length === 0) {
        container.innerHTML = `<div class="alert alert-info">No ${partyType}s found in this business.</div>`;
        return;
      }

      const colHeaders = `
        <th>Name in Manager</th>
        <th style="width:130px;">Taxpayer Type</th>
        <th style="width:120px;">TIN</th>
        <th style="width:70px;">Branch</th>
        <th style="width:150px;">Company / Corp Name</th>
        <th style="width:100px;">Last Name</th>
        <th style="width:90px;">First Name</th>
        <th style="width:60px;">MI</th>
        <th style="width:150px;">Address 1</th>
        <th style="width:140px;">Address 2</th>
        <th></th>`;

      const rows = cache.map((rec, idx) => {
        const cf = rec.value.customFields || {};
        const pType    = cf[PARTY_FIELDS[0].id] || 'Non-Individual';
        const isInd    = pType === 'Individual';
        const tin      = cf[PARTY_FIELDS[1].id] || '';
        const branch   = cf[PARTY_FIELDS[2].id] || '';
        const corp     = cf[PARTY_FIELDS[3].id] || '';
        const ln       = cf[PARTY_FIELDS[4].id] || '';
        const fn       = cf[PARTY_FIELDS[5].id] || '';
        const mn       = cf[PARTY_FIELDS[6].id] || '';
        const addr1    = cf[PARTY_FIELDS[7].id] || '';
        const addr2    = cf[PARTY_FIELDS[8].id] || '';

        return `<tr data-key="${esc(rec.key)}" data-idx="${idx}">
          <td style="font-weight:600;min-width:140px;font-size:11px;">${esc(rec.value.Name || rec.key)}</td>
          <td>
            <select class="form-select cf-ptype" style="width:120px;font-size:10px;"
              onchange="cfPartyToggle(this)">
              <option value="Non-Individual"${!isInd?' selected':''}>Non-Individual</option>
              <option value="Individual"${isInd?' selected':''}>Individual</option>
            </select>
          </td>
          <td><input class="form-input cf-tin"    style="width:115px;font-size:10px;" placeholder="000-000-000-000" value="${esc(tin)}"></td>
          <td><input class="form-input cf-branch" style="width:60px;font-size:10px;"  placeholder="000"             value="${esc(branch)}"></td>
          <td><input class="form-input cf-corp"   style="width:145px;font-size:10px;" placeholder="Corp/Company"
            value="${esc(corp)}" ${isInd?'disabled style="background:#f1f5f9;color:#94a3b8;width:145px;font-size:10px;"':''}></td>
          <td><input class="form-input cf-ln"     style="width:95px;font-size:10px;"  placeholder="Last"
            value="${esc(ln)}"   ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;width:95px;font-size:10px;"':''}></td>
          <td><input class="form-input cf-fn"     style="width:85px;font-size:10px;"  placeholder="First"
            value="${esc(fn)}"   ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;width:85px;font-size:10px;"':''}></td>
          <td><input class="form-input cf-mn"     style="width:55px;font-size:10px;"  placeholder="MI"
            value="${esc(mn)}"   ${!isInd?'disabled style="background:#f1f5f9;color:#94a3b8;width:55px;font-size:10px;"':''}></td>
          <td><input class="form-input cf-a1"     style="width:145px;font-size:10px;" placeholder="Unit, Bldg, Street" value="${esc(addr1)}"></td>
          <td><input class="form-input cf-a2"     style="width:135px;font-size:10px;" placeholder="City, Province"     value="${esc(addr2)}"></td>
          <td>
            <button class="btn btn-primary btn-sm" data-action="cf-save-row"
              onclick="cfSavePartyRow(this,'${partyType}')">Save</button>
          </td>
        </tr>`;
      }).join('');

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <input type="text" class="form-input" id="cf-${partyType}-search"
            placeholder="Search…" style="width:200px;"
            oninput="cfPartySearch(this,'cf-${partyType}-table')">
          <span style="font-size:11px;color:#6b7280;">${cache.length} records · Save per row to write to Manager</span>
          <button class="btn btn-outline btn-sm" style="margin-left:auto;"
            onclick="cfSaveAllParty('${partyType}')">💾 Save All</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" id="cf-${partyType}-table">
            <thead><tr>${colHeaders}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // Called when a row's Save button is clicked
    async function saveRow(btn) {
      const tr  = btn.closest('tr');
      const key = tr.dataset.key;
      const idx = parseInt(tr.dataset.idx, 10);
      const business = biz();
      if (!business || !key) return;

      const rec = cache[idx];
      if (!rec) return;

      const pType = tr.querySelector('.cf-ptype')?.value || 'Non-Individual';
      const isInd = pType === 'Individual';

      const updates = [
        { field: PARTY_FIELDS[0], value: pType },
        { field: PARTY_FIELDS[1], value: tr.querySelector('.cf-tin')?.value.trim()    || '' },
        { field: PARTY_FIELDS[2], value: tr.querySelector('.cf-branch')?.value.trim() || '' },
        { field: PARTY_FIELDS[3], value: !isInd ? (tr.querySelector('.cf-corp')?.value.trim() || '') : '' },
        { field: PARTY_FIELDS[4], value: isInd  ? (tr.querySelector('.cf-ln')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[5], value: isInd  ? (tr.querySelector('.cf-fn')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[6], value: isInd  ? (tr.querySelector('.cf-mn')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[7], value: tr.querySelector('.cf-a1')?.value.trim() || '' },
        { field: PARTY_FIELDS[8], value: tr.querySelector('.cf-a2')?.value.trim() || '' },
      ];

      const updated = Object.assign({}, rec.value, {
        customFields: patchCF(rec.value.customFields, updates),
      });

      try {
        await apiRequest('PUT', putPath, { Business: business, Key: key, Value: updated });
        rec.value = updated;
        flash(btn, true);
      } catch (err) {
        console.error(err);
        flash(btn, false);
      }
    }

    // Save All: iterate every visible row
    async function saveAll() {
      const rows = container.querySelectorAll('tbody tr');
      let ok = 0, fail = 0;
      for (const tr of rows) {
        const btn = tr.querySelector('[data-action="cf-save-row"]');
        if (btn) {
          try { await saveRowByTr(tr); ok++; }
          catch { fail++; }
        }
      }
      if (typeof showToast === 'function')
        showToast(fail === 0 ? `✅ ${ok} ${partyType}s saved.` : `⚠️ ${ok} saved, ${fail} failed.`, fail === 0 ? 'ok' : 'err');
    }

    async function saveRowByTr(tr) {
      const key = tr.dataset.key;
      const idx = parseInt(tr.dataset.idx, 10);
      const business = biz();
      const rec = cache[idx];
      if (!rec || !key || !business) return;
      const pType = tr.querySelector('.cf-ptype')?.value || 'Non-Individual';
      const isInd = pType === 'Individual';
      const updates = [
        { field: PARTY_FIELDS[0], value: pType },
        { field: PARTY_FIELDS[1], value: tr.querySelector('.cf-tin')?.value.trim()    || '' },
        { field: PARTY_FIELDS[2], value: tr.querySelector('.cf-branch')?.value.trim() || '' },
        { field: PARTY_FIELDS[3], value: !isInd ? (tr.querySelector('.cf-corp')?.value.trim() || '') : '' },
        { field: PARTY_FIELDS[4], value: isInd  ? (tr.querySelector('.cf-ln')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[5], value: isInd  ? (tr.querySelector('.cf-fn')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[6], value: isInd  ? (tr.querySelector('.cf-mn')?.value.trim()   || '') : '' },
        { field: PARTY_FIELDS[7], value: tr.querySelector('.cf-a1')?.value.trim() || '' },
        { field: PARTY_FIELDS[8], value: tr.querySelector('.cf-a2')?.value.trim() || '' },
      ];
      const updated = Object.assign({}, rec.value, {
        customFields: patchCF(rec.value.customFields, updates),
      });
      await apiRequest('PUT', putPath, { Business: business, Key: key, Value: updated });
      rec.value = updated;
    }

    // Expose save functions on window so inline onclick can reach them
    window[`cfSavePartyRow_${partyType}`] = function(btn) { saveRow(btn); };
    window[`cfSaveAll_${partyType}`]      = function()    { saveAll(); };

    return { refresh };
  }

  // ── GLOBAL HELPERS (called from inline onclicks) ──────────────────────────

  window.cfPartyToggle = function(sel) {
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
    dis('cf-corp', isInd);
    dis('cf-ln',  !isInd);
    dis('cf-fn',  !isInd);
    dis('cf-mn',  !isInd);
  };

  window.cfPartySearch = function(inp, tableId) {
    const q = inp.value.toLowerCase();
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
      const name = (tr.querySelector('td:first-child')?.textContent || '').toLowerCase();
      tr.style.display = name.includes(q) ? '' : 'none';
    });
  };

  // cfSavePartyRow / cfSaveAllParty are routers: they delegate to the
  // per-instance functions registered above.
  window.cfSavePartyRow = function(btn, pType) {
    const fn = window[`cfSavePartyRow_${pType}`];
    if (fn) fn(btn);
  };
  window.cfSaveAllParty = function(pType) {
    const fn = window[`cfSaveAll_${pType}`];
    if (fn) fn();
  };

  // ── UTILITIES ─────────────────────────────────────────────────────────────

  function noBusinessMsg() {
    return `<div class="alert alert-info">Please select a business above.</div>`;
  }

  function spinner(msg) {
    return `<div class="spinner-wrap"><div class="spinner"></div><span>${esc(msg)}</span></div>`;
  }

  // ── PUBLIC API: mount into setup tab panels ───────────────────────────────
  // Call these from setup.js after renderSetup() creates the tab panels.
  //
  //   const cfBiz = CF.mountBusiness(document.getElementById('tab-info'));
  //   cfBiz.refresh();
  //
  //   const cfCust = CF.mountParty(document.getElementById('tab-customers'), 'customer');
  //   cfCust.refresh();

  // ── SECTION: EMPLOYEES ──────────────────────────────────────────────────────
  // BIR-required fields stored in Manager's employee customFields bag.

  const EMPLOYEE_FIELDS = [
    { id: 'b1r00003-0000-4000-a000-000000000001', label: 'TIN',                     type: 'text',   placeholder: '000-000-000-000' },
    { id: 'b1r00003-0000-4000-a000-000000000002', label: 'SSS Number',               type: 'text',   placeholder: 'XX-XXXXXXX-X' },
    { id: 'b1r00003-0000-4000-a000-000000000003', label: 'PhilHealth Number',        type: 'text',   placeholder: 'XX-XXXXXXXXX-X' },
    { id: 'b1r00003-0000-4000-a000-000000000004', label: 'Pag-IBIG (HDMF) Number',  type: 'text',   placeholder: 'XXXX-XXXX-XXXX' },
    { id: 'b1r00003-0000-4000-a000-000000000005', label: 'Employment Status',        type: 'select',
      options: ['', 'Regular', 'Contractual', 'Probationary', 'Part-time', 'Casual'] },
    { id: 'b1r00003-0000-4000-a000-000000000006', label: 'Tax Status (exemptions)',  type: 'select',
      options: ['', 'S', 'S1', 'S2', 'S3', 'S4', 'ME', 'ME1', 'ME2', 'ME3', 'ME4'] },
    { id: 'b1r00003-0000-4000-a000-000000000007', label: 'Last Name',                type: 'text',   placeholder: 'Dela Cruz' },
    { id: 'b1r00003-0000-4000-a000-000000000008', label: 'First Name',               type: 'text',   placeholder: 'Juan' },
    { id: 'b1r00003-0000-4000-a000-000000000009', label: 'Middle Name',              type: 'text',   placeholder: 'Santos' },
    { id: 'b1r00003-0000-4000-a000-000000000010', label: 'Date of Birth',            type: 'date' },
    { id: 'b1r00003-0000-4000-a000-000000000011', label: 'Address',                  type: 'text',   placeholder: 'Unit, Bldg, Street, Barangay, City' },
  ];

  function mountEmployeeSection(container) {
    let cache = [];

    async function refresh() {
      const business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading employees from Manager…');
      try {
        const items = await fetchAllBatch('/api4/employee-batch', business);
        cache = items
          .map(it => ({ key: it.key, value: it.item || {} }))
          .sort((a, b) => (a.value.Name || a.value.name || '').localeCompare(b.value.Name || b.value.name || ''));
      } catch (err) {
        container.innerHTML = `<div class="alert alert-error">❌ ${esc(err.message)}</div>`;
        return;
      }
      render();
    }

    function render() {
      if (!cache.length) {
        container.innerHTML = '<div class="alert alert-info">No employees found in this business.</div>';
        return;
      }
      const opts = cache.map(e =>
        `<option value="${esc(e.key)}">${esc(e.value.Name || e.value.name || e.key)}</option>`
      ).join('');
      container.innerHTML = `
        <p style="font-size:11px;color:#6b7280;margin-bottom:12px;">
          BIR fields stored in Manager's employee record. Select an employee to edit.
        </p>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <label style="font-size:12px;color:#6b7280;">Employee</label>
          <select id="cf-emp-picker" style="font-size:12px;min-width:220px;">
            <option value="">— select an employee —</option>${opts}
          </select>
        </div>
        <div id="cf-emp-form-host"></div>`;
      container.querySelector('#cf-emp-picker').addEventListener('change', e => renderForm(e.target.value));
    }

    function renderForm(key) {
      const host = container.querySelector('#cf-emp-form-host');
      if (!host) return;
      if (!key) { host.innerHTML = ''; return; }
      const emp = cache.find(e => e.key === key);
      if (!emp) return;
      const groups = [
        { heading: 'BIR Identity',        fields: EMPLOYEE_FIELDS.slice(0, 4) },
        { heading: 'Employment Details',   fields: EMPLOYEE_FIELDS.slice(4, 6) },
        { heading: 'Personal Information', fields: EMPLOYEE_FIELDS.slice(6) },
      ];
      host.innerHTML = `
        <form id="cf-emp-save-form">
          ${groups.map(g => `
            <fieldset style="border:.5px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:12px;">
              <legend style="font-size:11px;font-weight:500;color:#6b7280;padding:0 6px;">${esc(g.heading)}</legend>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${g.fields.map(f => renderField(f, readCF(emp.value, f), `emp-${key}`)).join('')}
              </div>
            </fieldset>`).join('')}
          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" id="cf-emp-save-btn">💾 Save employee</button>
          </div>
        </form>`;
      host.querySelector('#cf-emp-save-form').addEventListener('submit', e => onSave(e, emp));
    }

    async function onSave(e, emp) {
      e.preventDefault();
      const business = biz();
      if (!business) return;
      const btn = document.getElementById('cf-emp-save-btn');
      const updates = collectValues(e.currentTarget, EMPLOYEE_FIELDS);
      const updated = Object.assign({}, emp.value, {
        customFields: patchCF(emp.value.customFields, updates),
      });
      try {
        await apiRequest('PUT', '/api4/employee', { Business: business, Key: emp.key, Value: updated });
        emp.value = updated;
        flash(btn, true);
      } catch (err) {
        console.error(err);
        flash(btn, false);
      }
    }

    return { refresh };
  }

  // ── SECTION: PAYSLIP ITEMS ───────────────────────────────────────────────────
  // Maps payslip items to BIR reporting categories for 1601C, SAWT, and 2316.

  const PAYSLIP_ITEM_TYPES = [
    {
      key: 'earnings', label: 'Earnings', endpoint: 'payslip-earnings-item',
      categories: [
        { id: 'ph-bir-earn-01', name: 'Basic Salary' },
        { id: 'ph-bir-earn-02', name: 'Overtime Pay' },
        { id: 'ph-bir-earn-03', name: 'Holiday Pay' },
        { id: 'ph-bir-earn-04', name: 'Night Differential' },
        { id: 'ph-bir-earn-05', name: 'Hazard Pay' },
        { id: 'ph-bir-earn-06', name: '13th Month Pay (taxable portion)' },
        { id: 'ph-bir-earn-07', name: 'De Minimis Benefits (non-taxable)' },
        { id: 'ph-bir-earn-08', name: 'Other Taxable Allowances' },
        { id: 'ph-bir-earn-09', name: 'Separation Pay / Retirement' },
      ],
    },
    {
      key: 'deductions', label: 'Deductions', endpoint: 'payslip-deduction-item',
      categories: [
        { id: 'ph-bir-ded-01', name: 'Withholding Tax on Compensation' },
        { id: 'ph-bir-ded-02', name: 'SSS Contribution' },
        { id: 'ph-bir-ded-03', name: 'PhilHealth Contribution' },
        { id: 'ph-bir-ded-04', name: 'Pag-IBIG (HDMF) Contribution' },
        { id: 'ph-bir-ded-05', name: 'Other Deductions (non-BIR)' },
      ],
    },
    {
      key: 'contributions', label: 'Employer Contributions', endpoint: 'payslip-contribution-item',
      categories: [
        { id: 'ph-bir-con-01', name: 'SSS – Employer Share' },
        { id: 'ph-bir-con-02', name: 'PhilHealth – Employer Share' },
        { id: 'ph-bir-con-03', name: 'Pag-IBIG – Employer Share' },
      ],
    },
  ];

  function mountPayslipItemsSection(container) {
    const caches = {};

    async function refresh() {
      const business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading payslip items…');
      try {
        const results = await Promise.all(
          PAYSLIP_ITEM_TYPES.map(t => fetchAllBatch(`/api4/${t.endpoint}-batch`, business))
        );
        PAYSLIP_ITEM_TYPES.forEach((t, i) => {
          caches[t.key] = (results[i] || [])
            .map(it => ({ key: it.key, value: it.item || {} }))
            .sort((a, b) => (a.value.Name || a.value.name || '').localeCompare(b.value.Name || b.value.name || ''));
        });
      } catch (err) {
        container.innerHTML = `<div class="alert alert-error">❌ ${esc(err.message)}</div>`;
        return;
      }
      render();
    }

    function render() {
      container.innerHTML = `
        <p style="font-size:11px;color:#6b7280;margin-bottom:14px;">
          Assign each payslip item to a BIR reporting category so values flow into
          the correct lines of 1601C, SAWT, and 2316. Saves one row at a time.
        </p>
        ${PAYSLIP_ITEM_TYPES.map(type => renderTable(type)).join('')}`;
      container.querySelectorAll('[data-action="save-payslip-item"]')
        .forEach(btn => btn.addEventListener('click', onSave));
    }

    function renderTable(type) {
      const items = caches[type.key] || [];
      const heading = `<h3 style="margin:16px 0 6px;font-size:13px;font-weight:500;">${esc(type.label)}</h3>`;
      if (!items.length) return `${heading}<p class="muted">No ${esc(type.label.toLowerCase())} items in this business.</p>`;
      const catOpts = '<option value="">— none —</option>' +
        type.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      const rows = items.map((it, idx) => {
        const current = it.value.reportingCategory || '';
        const opts = catOpts.replace(`value="${esc(current)}"`, `value="${esc(current)}" selected`);
        return `<tr data-type="${type.key}" data-key="${esc(it.key)}" data-idx="${idx}"
          style="border-bottom:.5px solid #f3f4f6;">
          <td style="padding:6px 8px;font-size:12px;font-weight:500;">
            ${esc(it.value.Name || it.value.name || it.key)}
          </td>
          <td style="padding:6px 8px;">
            <select data-role="cat" style="width:100%;font-size:12px;">${opts}</select>
          </td>
          <td style="padding:6px 8px;">
            <button class="btn btn-primary btn-sm" data-action="save-payslip-item"
              style="font-size:11px;">Save</button>
          </td>
        </tr>`;
      }).join('');
      return `${heading}
        <div style="overflow-x:auto;margin-bottom:8px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="font-size:11px;color:#9ca3af;">
              <th style="text-align:left;padding:5px 8px;font-weight:500;">Item</th>
              <th style="padding:5px 8px;font-weight:500;">BIR Reporting Category</th>
              <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    async function onSave(e) {
      const btn = e.currentTarget;
      const row = btn.closest('tr');
      const typeKey = row.dataset.type;
      const type = PAYSLIP_ITEM_TYPES.find(t => t.key === typeKey);
      const idx = parseInt(row.dataset.idx, 10);
      const key = row.dataset.key;
      const business = biz();
      if (!business || !type) return;
      const rec = caches[typeKey][idx];
      if (!rec) return;
      const newCat = row.querySelector('[data-role="cat"]').value || null;
      const updated = Object.assign({}, rec.value, { reportingCategory: newCat });
      try {
        await apiRequest('PUT', `/api4/${type.endpoint}`,
          { Business: business, Key: key, Value: updated });
        rec.value = updated;
        flash(btn, true);
      } catch (err) {
        console.error(err);
        flash(btn, false);
      }
    }

    return { refresh };
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────────
  window.CF = {
    mountBusiness:    mountBusinessSection,
    mountParty:       mountPartySection,
    mountEmployees:   mountEmployeeSection,
    mountPayslipItems: mountPayslipItemsSection,
    BUSINESS_FIELDS,
    PARTY_FIELDS,
    EMPLOYEE_FIELDS,
    readCF,
    readPartyField: function(model, fieldLabel) {
      const f = PARTY_FIELDS.find(x => x.label === fieldLabel);
      return f ? readCF(model, f) : '';
    },
  };

})();
