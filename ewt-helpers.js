/* ============================================================
   Tallo CPA – BIR Tax App
   ewt-helpers.js  –  Shared ATC master table + EWT line extraction
                       Used by 2307-report.js and qap-report.js
   ============================================================ */

// ── ATC MASTER (BIR standard Expanded Withholding Tax codes) ──
const ATC_MASTER = {
  // Professional fees
  'WI010': { desc: 'Professional fees - Individual',              rate: 10 },
  'WI011': { desc: 'Professional fees - Individual (>P3M/VAT)',    rate: 15 },
  'WI012': { desc: 'Professional fees - Individual (>P720k)',      rate: 15 },
  'WC010': { desc: 'Professional fees - Non-individual',           rate: 15 },
  // Rental
  'WI100': { desc: 'Rental - Individual',                          rate: 5  },
  'WC100': { desc: 'Rental - Non-individual',                      rate: 5  },
  'WI120': { desc: 'Rental - Individual',                          rate: 5  },
  'WC120': { desc: 'Rental - Non-individual',                      rate: 5  },
  // Purchase of goods (top withholding agents)
  'WI158': { desc: 'Purchase of goods - Individual',               rate: 1  },
  'WC158': { desc: 'Purchase of goods - Non-individual',           rate: 1  },
  // Purchase of services (top withholding agents)
  'WI159': { desc: 'Purchase of services - Individual',            rate: 2  },
  'WC159': { desc: 'Purchase of services - Non-individual',        rate: 2  },
  // Commissions
  'WI515': { desc: 'Commission - Individual',                      rate: 10 },
  'WI516': { desc: 'Commission - Individual (>P3M/VAT)',           rate: 15 },
  'WC515': { desc: 'Commission - Non-individual',                  rate: 10 },
  'WC516': { desc: 'Commission - Non-individual (>P3M/VAT)',       rate: 15 },
  // Contractors
  'WI108': { desc: 'Income payments to contractors - Individual',  rate: 2  },
  'WC108': { desc: 'Income payments to contractors - Non-individual', rate: 2 },
  'WI110': { desc: 'Contractors - Individual',                     rate: 2  },
  'WC110': { desc: 'Contractors - Non-individual',                 rate: 2  },
  // Income from real property
  'WI160': { desc: 'Income payments by real estate - Individual',  rate: 6  },
  'WC160': { desc: 'Income payments by real estate - Non-individual', rate: 6 },
  // Tolling fee
  'WC140': { desc: 'Tolling fees paid to refineries',               rate: 5 },
  // Additional income payments
  'WI530': { desc: 'Gross payments to embalmers - Individual',     rate: 1  },
  'WC535': { desc: 'Payments by pre-need companies to funeral parlors', rate: 1 },
  // Income payment made by top withholding agents
  'WI640': { desc: 'Income payments by GOCC to suppliers of goods', rate: 1 },
  'WC640': { desc: 'Income payments by GOCC to suppliers of goods', rate: 1 },
  'WI157': { desc: 'Income payments by GOCC to suppliers of services', rate: 2 },
  'WC157': { desc: 'Income payments by GOCC to suppliers of services', rate: 2 },
};

// User-defined tax code → ATC mapping (loaded from localStorage, per browser)
function loadAtcMapping() {
  try { return JSON.parse(localStorage.getItem('tc_atc_map') || '{}'); } catch(e) { return {}; }
}

function saveAtcMapping(map) {
  localStorage.setItem('tc_atc_map', JSON.stringify(map || {}));
}

// Resolve a Manager.io tax code name to ATC info: { atc, desc, rate }
function resolveAtc(taxCodeName, customAtcMap) {
  if (!taxCodeName) return null;
  const upper = String(taxCodeName).toUpperCase().trim();
  customAtcMap = customAtcMap || {};
  if (ATC_MASTER[upper]) return { atc: upper, ...ATC_MASTER[upper] };
  if (customAtcMap[upper]) return customAtcMap[upper];
  for (const atc of Object.keys(ATC_MASTER)) {
    if (upper.includes(atc)) return { atc, ...ATC_MASTER[atc] };
  }
  // Try matching by ATC code embedded within custom-mapped names too
  for (const [name, info] of Object.entries(customAtcMap)) {
    if (upper.includes(name)) return info;
  }
  return null;
}

// Extract EWT lines from a purchase invoice / payment item.
// Returns array of { atc, desc, rate, base, ewt }
function extractEWT(item, customAtcMap) {
  const lines = item?.lines || item?.Lines || item?.purchaseInvoiceLines || [];
  const result = {};

  lines.forEach(line => {
    const tcRaw  = line?.taxCode ?? line?.TaxCode ?? '';
    const tcName = (tcRaw && typeof tcRaw === 'object')
      ? (tcRaw.name || tcRaw.Name || '')
      : (line?.taxCodeName || line?.TaxCodeName || tcRaw || '');
    const atcInfo = resolveAtc(tcName, customAtcMap);
    if (!atcInfo) return;

    const qty       = Number(line?.qty ?? line?.Qty ?? line?.quantity ?? 1);
    const unitPrice = Number(line?.purchaseUnitPrice ?? line?.unitPrice ?? line?.UnitPrice ?? line?.amount ?? 0);
    let lineTotal   = Number(line?.total ?? line?.Total ?? (unitPrice * qty));
    if (line?.discountPercentage) lineTotal *= (1 - Number(line.discountPercentage) / 100);
    lineTotal -= Number(line?.discountAmount || 0);

    const taxBase = Math.abs(lineTotal);
    const taxAmt  = Number(line?.taxAmount ?? line?.TaxAmount ?? (taxBase * atcInfo.rate / 100));

    const atc = atcInfo.atc;
    if (!result[atc]) {
      result[atc] = { atc, desc: atcInfo.desc, rate: atcInfo.rate, base: 0, ewt: 0 };
    }
    result[atc].base += taxBase;
    result[atc].ewt  += Math.abs(taxAmt) || (taxBase * atcInfo.rate / 100);
  });

  return Object.values(result);
}

// month-in-quarter index (0,1,2) from a date string/Date
function monthInQuarter(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  return d.getMonth() % 3;
}
