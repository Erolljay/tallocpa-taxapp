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
    const qs = new URLSearchParams({ business: businessName, Skip: String(skip), PageSize: String(PAGE) }).toString();
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
    App.currentBusiness = sel.value || App.businesses[0]?.name || '';
    sel.value = App.currentBusiness;
    sel.addEventListener('change', () => {
      App.currentBusiness = sel.value;
      if (onchange) onchange();
    });
    if (onchange && App.currentBusiness) onchange();
  } catch (e) {
    const sel = document.getElementById(selectId);
    if (sel) sel.innerHTML = '<option value="">⚠ Could not load</option>';
    console.error(e);
  }
}

// ── REPORT CONTEXT — for pages opened via Manager Custom Button ──
// ── PAGE CONTEXT — ask Manager which business this tab belongs to ──
function getPageContextBusiness() {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 3000);
    function handler(event) {
      const d = event.data;
      if (d?.type === 'page-response' && d?.requestId === requestId) {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve(d?.body?.query?.business || null);
      }
    }
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'page-request', requestId }, '*');
  });
}

async function getReportBusiness(containerEl) {
  const ctxBiz = await getPageContextBusiness();

  const res = await apiRequest('GET', '/api4/businesses');
  const businesses = res?.businesses || [];
  if (!businesses.length) throw new Error('No businesses found in Manager.');

  // ctxBiz from the page URL may be a numeric index rather than the business name.
  // Resolve it to the actual name.
  if (ctxBiz) {
    const byName = businesses.find(b => b.name === ctxBiz);
    if (byName) {
      App.currentBusiness = byName.name;
      return byName.name;
    }
    const idx = parseInt(ctxBiz, 10);
    if (!isNaN(idx)) {
      // Manager uses 1-based or 0-based index depending on version — try both.
      const byIdx = businesses[idx] || businesses[idx - 1];
      if (byIdx) {
        App.currentBusiness = byIdx.name;
        return byIdx.name;
      }
    }
  }

  if (businesses.length === 1) {
    App.currentBusiness = businesses[0].name;
    return businesses[0].name;
  }
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:12px;';
    wrap.innerHTML = `<strong>Business:</strong>
      <select id="report-biz-sel" style="font-size:12px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;">
        ${businesses.map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`).join('')}
      </select>
      <button id="report-biz-ok" class="btn btn-primary" style="font-size:11px;padding:4px 12px;">Select</button>`;
    if (containerEl) containerEl.prepend(wrap);
    document.getElementById('report-biz-ok').addEventListener('click', () => {
      const val = document.getElementById('report-biz-sel').value;
      App.currentBusiness = val;
      wrap.remove();
      resolve(val);
    });
  });
}

// ── MANAGER MAPPING GUIDS ────────────────────────────────────
const MAPPING_GUIDS = {
  vatMapping:     'b1r00099-0000-4000-a000-000000000001',
  ewtMapping:     'b1r00099-0000-4000-a000-000000000002',
  fwtMapping:     'b1r00099-0000-4000-a000-000000000003',
  ptMapping:      'b1r00099-0000-4000-a000-000000000004',
  payrollMapping: 'b1r00099-0000-4000-a000-000000000005',
};

// Read/save payroll category mapping { itemKey -> birCategoryId }
// Reads ALL customFields2 strings and collects entries whose values start with
// 'ph-bir-' — this catches data saved under any GUID from any session.
async function getPayrollMapping(biz) {
  const bizRec = await getOrCreateBizDataRecord(biz);
  const strings = (bizRec.value.customFields2 && bizRec.value.customFields2.strings) || {};
  const merged = {};
  for (const raw of Object.values(strings)) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.startsWith('ph-bir-')) merged[k] = v;
        }
      }
    } catch { /* skip non-JSON or invalid entries */ }
  }
  return merged;
}

async function savePayrollMapping(biz, mapping) {
  const guids = await ensureBIRFields(biz);
  const targetGuid = guids && guids.mapping;
  if (!targetGuid) throw new Error('BIR Mapping Data custom field not available');
  return saveBizDataRecord(biz, targetGuid, mapping);
}

// ── BIR CUSTOM FIELD DEFINITIONS ─────────────────────────────
const BIR_CF_NAMES = {
  biz:     'BIR Business Data',
  party:   'BIR Party Data',
  emp:     'BIR Employee Data',
  mapping: 'BIR Mapping Data',
};

// Known Manager custom-field placement GUIDs (confirmed via API).
const BIR_PLACEMENTS = {
  biz:   [{ Key: '38cf4712-6e95-4ce1-b53a-bff03edad273', UniqueName: 'Business Details' }],
  party: [
    { Key: 'ec37c11e-2b67-49c6-8a58-6eccb7dd75ee', UniqueName: 'Customer' },
    { Key: '6d2dc48d-2053-4e45-8330-285ebd431242', UniqueName: 'Supplier' },
  ],
  emp:   [{ Key: 'dadb7f95-a5dd-45c0-945d-6ad4ee28776e', UniqueName: 'Employee' }],
};

const _birGuidCache = {};

// Looks up custom field DEFINITION GUIDs by name (needed to read/write record data).
// BIR_PLACEMENTS above are placement GUIDs (UI location) — different from definition GUIDs.
async function ensureBIRFields(biz) {
  if (_birGuidCache[biz]) return _birGuidCache[biz];

  let items = [];
  try {
    items = await fetchAllBatch('/api4/text-custom-field-batch', biz);
  } catch(e) {
    console.warn('ensureBIRFields: batch fetch failed:', e.message);
  }
  const findGuid = name => {
    const it = items.find(i => {
      const it2 = i.item || i.value || i;
      const n = it2.name || it2.Name;
      return n === name;
    });
    return it ? (it.key || it.Key) : null;
  };
  // Collect ALL GUIDs for 'BIR Mapping Data' — previous sessions may have created duplicates.
  const findAllGuids = name => items
    .filter(i => { const it2 = i.item || i.value || i; return (it2.name || it2.Name) === name; })
    .map(i => i.key || i.Key)
    .filter(Boolean);

  const guids = {
    biz:         findGuid(BIR_CF_NAMES.biz),
    party:       findGuid(BIR_CF_NAMES.party),
    emp:         findGuid(BIR_CF_NAMES.emp),
    mapping:     findGuid(BIR_CF_NAMES.mapping),
    allMappings: findAllGuids(BIR_CF_NAMES.mapping),
  };

  // Create any missing definitions
  const defs = [
    { slot: 'biz',     name: BIR_CF_NAMES.biz,     placement: BIR_PLACEMENTS.biz.map(p => p.Key)   },
    { slot: 'party',   name: BIR_CF_NAMES.party,   placement: BIR_PLACEMENTS.party.map(p => p.Key) },
    { slot: 'emp',     name: BIR_CF_NAMES.emp,     placement: BIR_PLACEMENTS.emp.map(p => p.Key)   },
    { slot: 'mapping', name: BIR_CF_NAMES.mapping, placement: BIR_PLACEMENTS.party.map(p => p.Key) },
  ];
  for (const def of defs) {
    if (guids[def.slot]) continue;
    try {
      const created = await apiRequest('POST', '/api4/text-custom-field', {
        value: { name: def.name, lockedForManualEditing: true, placement: def.placement },
      });
      if (created) {
        guids[def.slot] = typeof created === 'string' ? created : (created.key || null);
      }
      if (!guids[def.slot]) {
        const re = await fetchAllBatch('/api4/text-custom-field-batch', biz);
        const found = re.find(i => {
          const it2 = i.item || i.value || i;
          const n = it2.name || it2.Name;
          return n === def.name;
        });
        if (found) guids[def.slot] = found.key || found.Key;
      }
    } catch(e) {
      console.warn('ensureBIRFields: could not create', def.name, ':', e.message);
    }
  }

  // customer and supplier share the same 'BIR Party Data' definition
  guids.customer = guids.party;
  guids.supplier = guids.party;
  // mapping slot is placed on customer (same placements as party)

  _birGuidCache[biz] = guids;
  return guids;
}

// Parse the BIR JSON blob from a Manager record's customFields2.strings using the real GUID.
// If the canonical guid has no data (e.g. record was saved under an older/orphaned
// definition GUID), fall back to scanning all stored blobs for one whose keys match
// fallbackPrefix (e.g. 'b1r00002-' for party fields).
function parseBIRBlob(managerCF, guid, fallbackPrefix) {
  if (!managerCF) return {};
  if (guid && managerCF[guid]) {
    try {
      const o = JSON.parse(managerCF[guid]);
      if (o && typeof o === 'object') return o;
    } catch {}
  }
  if (fallbackPrefix) {
    for (const k of Object.keys(managerCF)) {
      if (k === guid) continue;
      const v = managerCF[k];
      if (typeof v !== 'string') continue;
      try {
        const o = JSON.parse(v);
        if (o && typeof o === 'object' && Object.keys(o).some(kk => kk.startsWith(fallbackPrefix))) {
          return o;
        }
      } catch {}
    }
  }
  return {};
}

// Build Manager customFields2 object: preserves existing strings, replaces the BIR blob.
// Returns { strings: {...} } to be set as record.customFields2
function buildBIRCustomFields(existingRecord, guid, birData) {
  const existing2 = (existingRecord && existingRecord.customFields2) || {};
  const strings = Object.assign({}, existing2.strings || {});
  if (guid) strings[guid] = JSON.stringify(birData);
  return Object.assign({}, existing2, { strings });
}

// Load business-details from Manager
async function loadBizDetails(biz) {
  const model = await apiRequest('GET', `/api4/business-details?business=${encodeURIComponent(biz)}`);
  return model || {};
}

// ── BUSINESS-LEVEL BIR DATA STORE ────────────────────────────
// PUT /api4/business-details does not persist customFields2 via this bridge
// (confirmed Manager platform limitation). As a workaround, business-level
// BIR data (TIN, RDO code, address, etc.) is stored on a dedicated, active but hidden
// "dummy" customer record, identified by name.
const BIZ_DATA_RECORD_NAME = '__BIR_BUSINESS_DATA__';

// Find (or create) the dummy customer record used to hold business-level BIR data.
// Returns { key, value }.
async function getOrCreateBizDataRecord(biz) {
  const all = await fetchAllBatch('/api4/customer-batch', biz);
  const found = all.find(it => {
    const v = it.item || {};
    return (v.name || v.Name) === BIZ_DATA_RECORD_NAME;
  });
  if (found) {
    // Batch responses may omit customFields2 — fetch the full record by key.
    const full = await apiRequest('GET', `/api4/customer?business=${encodeURIComponent(biz)}&key=${encodeURIComponent(found.key)}`);
    return { key: found.key, value: full || found.item || {} };
  }

  const created = await apiRequest('POST', '/api4/customer', {
    business: biz,
    value: {
      name: BIZ_DATA_RECORD_NAME,
      inactive: false,
      customFields2: { strings: {} },
    },
  });
  const key = (created && (created.key || created.Key)) || (typeof created === 'string' ? created : null);
  if (!key) throw new Error('Could not create business data record');
  // Fetch the newly-created record so we have the full Manager schema for future PUTs.
  const fetched = await apiRequest('GET', `/api4/customer?business=${encodeURIComponent(biz)}&key=${encodeURIComponent(key)}`);
  return { key, value: fetched || { name: BIZ_DATA_RECORD_NAME, inactive: false, customFields2: { strings: {} } } };
}

// Save the business-level BIR blob into the dummy customer record's customFields2.strings.
async function saveBizDataRecord(biz, guid, birBlob) {
  const { key, value } = await getOrCreateBizDataRecord(biz);
  const managerCF2 = buildBIRCustomFields(value, guid, birBlob);
  // Mirror back exactly what Manager gave us, only overriding customFields2.
  // Building a field whitelist causes 400s when Manager's schema changes or
  // when required fields differ between versions.
  const putValue = Object.assign({}, ...Object.keys(value)
    .filter(k => k !== 'timestamp' && k !== 'id' && k !== 'key')
    .map(k => ({ [k]: value[k] })), { customFields2: managerCF2 });
  try {
    await apiRequest('PUT', '/api4/customer', { business: biz, key, value: putValue });
  } catch (err) {
    console.error('[saveBizDataRecord] PUT failed. key=%s body=%o err=%s', key, putValue, err.message);
    throw err;
  }
  return managerCF2;
}

// Read a specific mapping from a business-details model
function readMapping(model, type) {
  const guid = MAPPING_GUIDS[type];
  if (!guid) return {};
  const raw = (model.customFields || {})[guid];
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

// ── BIR FIELD GUIDs ──────────────────────────────────────────
const BIZ_GUIDS = {
  tin:           'b1r00001-0000-4000-a000-000000000001',
  rdoCode:       'b1r00001-0000-4000-a000-000000000002',
  branchCode:    'b1r00001-0000-4000-a000-000000000013',
  classification:'b1r00001-0000-4000-a000-000000000004',
  lineOfBusiness:'b1r00001-0000-4000-a000-000000000005',
  phone:         'b1r00001-0000-4000-a000-000000000015',
  email:         'b1r00001-0000-4000-a000-000000000016',
  companyName:   'b1r00001-0000-4000-a000-000000000009',
  lastName:      'b1r00001-0000-4000-a000-000000000010',
  firstName:     'b1r00001-0000-4000-a000-000000000011',
  middleName:    'b1r00001-0000-4000-a000-000000000012',
  substreet:     'b1r00001-0000-4000-a000-000000000017',
  street:        'b1r00001-0000-4000-a000-000000000018',
  barangay:      'b1r00001-0000-4000-a000-000000000019',
  municipality:  'b1r00001-0000-4000-a000-000000000020',
  cityProvince:  'b1r00001-0000-4000-a000-000000000021',
  zipCode:       'b1r00001-0000-4000-a000-000000000003',
  authRep:       'b1r00001-0000-4000-a000-000000000014',
  authRepTitle:  'b1r00001-0000-4000-a000-000000000022',
};

const PARTY_GUIDS = {
  type:        'b1r00002-0000-4000-a000-000000000001',
  tin:         'b1r00002-0000-4000-a000-000000000002',
  branchCode:  'b1r00002-0000-4000-a000-000000000003',
  companyName: 'b1r00002-0000-4000-a000-000000000004',
  lastName:    'b1r00002-0000-4000-a000-000000000005',
  firstName:   'b1r00002-0000-4000-a000-000000000006',
  middleName:  'b1r00002-0000-4000-a000-000000000007',
  address1:    'b1r00002-0000-4000-a000-000000000008',
  address2:    'b1r00002-0000-4000-a000-000000000009',
};

// Load business BIR setup from Manager and return a plain object.
async function loadSetup(biz) {
  try {
    const [model, guids, bizRec] = await Promise.all([loadBizDetails(biz), ensureBIRFields(biz), getOrCreateBizDataRecord(biz)]);
    const rawCF = (bizRec.value.customFields2 && bizRec.value.customFields2.strings) || {};
    const cf    = parseBIRBlob(rawCF, guids && guids.biz, 'b1r00001-');
    const cls   = cf[BIZ_GUIDS.classification] || '';
    const isInd = cls === 'Individual';
    const ln    = cf[BIZ_GUIDS.lastName]  || '';
    const fn    = cf[BIZ_GUIDS.firstName] || '';
    const mn    = cf[BIZ_GUIDS.middleName]|| '';
    const corp  = cf[BIZ_GUIDS.companyName] || '';
    const taxpayerName = isInd
      ? [ln, fn, mn].filter(Boolean).join(', ')
      : corp;
    const addrParts = [
      cf[BIZ_GUIDS.substreet], cf[BIZ_GUIDS.street], cf[BIZ_GUIDS.barangay],
      cf[BIZ_GUIDS.municipality], cf[BIZ_GUIDS.cityProvince],
    ].filter(Boolean);
    return {
      tin:            cf[BIZ_GUIDS.tin]            || '',
      rdoCode:        cf[BIZ_GUIDS.rdoCode]         || '',
      branchCode:     cf[BIZ_GUIDS.branchCode]      || '',
      classification: cls,
      lineOfBusiness: cf[BIZ_GUIDS.lineOfBusiness]  || '',
      companyName:    corp,
      taxpayerName,
      lastName: ln, firstName: fn, middleName: mn,
      address:  addrParts.join(', '),
      zipCode:  cf[BIZ_GUIDS.zipCode]       || '',
      authRep:  cf[BIZ_GUIDS.authRep]       || '',
      authRepTitle: cf[BIZ_GUIDS.authRepTitle] || '',
      vatMapping: readMapping(model, 'vatMapping'),
      ewtMapping: readMapping(model, 'ewtMapping'),
    };
  } catch(e) {
    console.warn('loadSetup failed:', e.message);
    return null;
  }
}

// Load all customers OR suppliers with their BIR custom fields.
async function loadPartyBIR(biz, partyType) {
  const batchPath = partyType === 'customer'
    ? '/api4/customer-batch'
    : '/api4/supplier-batch';
  try {
    const [all, guids] = await Promise.all([fetchAllBatch(batchPath, biz), ensureBIRFields(biz)]);
    const partyGuid = partyType === 'customer' ? guids.customer : guids.supplier;
    const result = {};
    all.forEach(it => {
      const rec   = it.item || {};
      if ((rec.name || rec.Name) === BIZ_DATA_RECORD_NAME) return;
      const rawCF = (rec.customFields2 && rec.customFields2.strings) || rec.customFields || {};
      const cf    = parseBIRBlob(rawCF, partyGuid, 'b1r00002-');
      result[it.key] = {
        name:        rec.name || rec.Name || it.key,
        type:        cf[PARTY_GUIDS.type]        || 'Non-Individual',
        tin:         cf[PARTY_GUIDS.tin]         || '',
        branchCode:  cf[PARTY_GUIDS.branchCode]  || '',
        companyName: cf[PARTY_GUIDS.companyName] || '',
        lastName:    cf[PARTY_GUIDS.lastName]    || '',
        firstName:   cf[PARTY_GUIDS.firstName]   || '',
        middleName:  cf[PARTY_GUIDS.middleName]  || '',
        address1:    cf[PARTY_GUIDS.address1]    || '',
        address2:    cf[PARTY_GUIDS.address2]    || '',
      };
    });
    return result;
  } catch(e) {
    console.warn('loadPartyBIR failed:', e.message);
    return {};
  }
}

// ── VAT MAPPING (auto-match Manager tax codes by standard name) ─
// Shared with 2550Q so SLS/SLP use the exact same tax-code keys.
const VAT_CATEGORY_TC_NAME = {
  sales_taxable:   'Output VAT 12%',
  sales_zero:      'Zero-Rated Sales',
  sales_exempt:    'VAT Exempt Sales',
  purch_capital:   'Input VAT 12% (Capital Goods)',
  purch_other:     'Input VAT 12% (Other Goods)',
  purch_services:  'Input VAT 12% (Services)',
  purch_zero:      'Zero-Rated Purchases',
  purch_exempt:    'VAT Exempt Purchases',
  govt_wv012:      'WV012 – Govt WHT VAT Goods (5%)',
  govt_wv022:      'WV022 – Govt WHT VAT Services (5%)',
};

async function fetchManagerTaxCodes(biz) {
  const items = await fetchAllBatch('/api4/tax-code-batch', biz);
  return items.map(row => {
    const data = row?.item || row?.value || row || {};
    const name = data.Name || data.name || data.Code || data.code || '';
    const rate = Number(data.rate ?? (Array.isArray(data.rates) ? data.rates[0] : 0)) || 0;
    return { key: row?.key || row?.Key || data.key || '', name: name || `(unnamed: ${row?.key || ''})`, rate };
  });
}

function autoMatchVatMapping(taxCodes) {
  const nameToKey = {};
  for (const tc of taxCodes) {
    const n = (tc.name || '').toLowerCase().trim();
    if (n) nameToKey[n] = tc.key;
  }
  const vm = {};
  for (const [catKey, tcName] of Object.entries(VAT_CATEGORY_TC_NAME)) {
    const k = nameToKey[tcName.toLowerCase().trim()];
    if (k) vm[catKey] = k;
  }
  return vm;
}

function overridesStorageKey(biz) { return `2550q_taxcode_overrides_${biz}`; }

function getMappingOverrides(biz) {
  try { return JSON.parse(localStorage.getItem(overridesStorageKey(biz))) || {}; }
  catch { return {}; }
}

function saveMappingOverrides(biz, overrides) {
  localStorage.setItem(overridesStorageKey(biz), JSON.stringify(overrides));
}

// ── EWT TAX CODE MAPPING (ATC -> Manager tax code) ───────────
// Shared by 1601EQ, 0619E, 2307, QAP. Requires ATC_MASTER from
// ewt-helpers.js to be loaded on the page.
function ewtOverridesStorageKey(biz) { return `ewt_taxcode_overrides_${biz}`; }

function getEwtMappingOverrides(biz) {
  try { return JSON.parse(localStorage.getItem(ewtOverridesStorageKey(biz))) || {}; }
  catch { return {}; }
}

function saveEwtMappingOverrides(biz, overrides) {
  localStorage.setItem(ewtOverridesStorageKey(biz), JSON.stringify(overrides));
}

// Auto-match Manager tax codes to BIR ATC codes by name (exact or
// substring match against ATC_MASTER keys), then apply saved overrides.
// Returns { tcKeyToAtc: { [managerTaxCodeKey]: {atc, desc, rate} }, atcToTcKey, taxCodes }
async function getEwtTcMap(biz) {
  const taxCodes = await fetchManagerTaxCodes(biz);
  const overrides = getEwtMappingOverrides(biz);
  const atcToTcKey = {};

  // Auto-match: tax code name contains an ATC code (e.g. "WC158")
  for (const atc of Object.keys(ATC_MASTER || {})) {
    const found = taxCodes.find(tc => (tc.name || '').toUpperCase().includes(atc));
    if (found) atcToTcKey[atc] = found.key;
  }
  // Apply overrides on top
  for (const [atc, tcKey] of Object.entries(overrides)) {
    if (tcKey) atcToTcKey[atc] = tcKey; else delete atcToTcKey[atc];
  }

  const tcKeyToAtc = {};
  for (const [atc, tcKey] of Object.entries(atcToTcKey)) {
    if (!tcKey) continue;
    const info = ATC_MASTER[atc];
    const tc = taxCodes.find(t => t.key === tcKey);
    // Prefer the real ATC rate from ATC_MASTER: Manager tax codes for EWT
    // are set up as 0%/100% pass-throughs (line amount = tax withheld), so
    // tc.rate is not the rate to use for grossing up the tax base.
    tcKeyToAtc[tcKey] = { atc, desc: info?.desc || atc, rate: Number(info?.rate ?? tc?.rate ?? 0) };
  }
  return { tcKeyToAtc, atcToTcKey, taxCodes };
}

// Final vm = auto-matched mapping with any saved overrides applied on top.
async function getVatMapping(biz) {
  const taxCodes = await fetchManagerTaxCodes(biz);
  const vm = autoMatchVatMapping(taxCodes);
  const overrides = getMappingOverrides(biz);
  for (const [catKey, tcKey] of Object.entries(overrides)) {
    if (tcKey) vm[catKey] = tcKey; else delete vm[catKey];
  }
  const rateByKey = {};
  for (const tc of taxCodes) rateByKey[tc.key] = tc.rate;
  return { vm, rateByKey };
}

// Compute net (tax-exclusive) amount and tax amount for an invoice/receipt/payment line.
function lineAmounts(item, line, rateByKey) {
  const qty       = Number(line?.qty ?? 1);
  const unitPrice = Number(line?.salesUnitPrice ?? line?.purchaseUnitPrice ?? line?.unitPrice ?? 0);
  let gross = qty * unitPrice;
  if (line?.discountPercentage) gross *= (1 - Number(line.discountPercentage) / 100);
  gross -= Number(line?.discountAmount || 0);

  const tcKey = line?.taxCode || line?.TaxCode || '';
  const rate  = Number(rateByKey?.[tcKey] ?? 0);
  const includesTax = !!item?.amountsIncludeTax;

  let net, tax;
  if (rate) {
    if (includesTax) { net = gross / (1 + rate / 100); tax = gross - net; }
    else             { net = gross; tax = gross * rate / 100; }
  } else {
    net = gross; tax = 0;
  }
  return { net: Math.abs(net), tax: Math.abs(tax), gross: Math.abs(gross) };
}

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
