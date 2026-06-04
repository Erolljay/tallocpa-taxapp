// Philippines BIR — Standard tax code templates.
// TAX_CODE_TEMPLATES: all BIR tax codes used by this extension.
//   Name        — exact name used in Manager (must match exactly)
//   Label       — display label / ATC description
//   birRate     — actual BIR rate shown in UI and used to back-calculate tax base
//   managerRate — rate to set when creating in Manager:
//                   100 for EWT/FWT/WB (workaround: line amount = withholding amount)
//                   actual rate for VAT/PT (Manager computes tax natively)
//   group       — one of: 'VAT' | 'PT' | 'EWT' | 'GOVT' | 'FWT'

const TAX_CODE_TEMPLATES = [

  // ── GROUP 1A: VALUE ADDED TAX ─────────────────────────────
  { Name: 'Output VAT 12%',                  Label: 'Standard VATable sales',                          birRate: 12.0, managerRate: 12.0, group: 'VAT' },
  { Name: 'Input VAT 12%',                   Label: 'Standard VATable purchases',                      birRate: 12.0, managerRate: 12.0, group: 'VAT' },
  { Name: 'Input VAT 12% (Capital Goods)',   Label: 'Capital expenditure purchases',                   birRate: 12.0, managerRate: 12.0, group: 'VAT' },
  { Name: 'Zero-Rated Sales',                Label: 'Export / PEZA / zero-rated',                      birRate: 0,    managerRate: 0,    group: 'VAT' },
  { Name: 'VAT Exempt Sales',                Label: 'Sales exempt from VAT',                           birRate: 0,    managerRate: 0,    group: 'VAT' },
  { Name: 'Zero-Rated Purchases',            Label: 'Zero-rated purchase inputs',                      birRate: 0,    managerRate: 0,    group: 'VAT' },
  { Name: 'VAT Exempt Purchases',            Label: 'Exempt purchase inputs',                          birRate: 0,    managerRate: 0,    group: 'VAT' },

  // ── GROUP 1B: PERCENTAGE TAX ──────────────────────────────
  { Name: 'PT010 – Percentage Tax 3%',       Label: 'PT010 – Non-VAT registered taxpayers',            birRate: 3.0,  managerRate: 3.0,  group: 'PT' },
  { Name: 'PT040 – Common Carrier 3%',       Label: 'PT040 – Domestic carriers & keepers of garages',  birRate: 3.0,  managerRate: 3.0,  group: 'PT' },
  { Name: 'PT101 – Nonbanks Financial 5%',   Label: 'PT101 – Nonbanks financial intermediaries',       birRate: 5.0,  managerRate: 5.0,  group: 'PT' },

  // ── GROUP 2: EWT / CWT ON INCOME PAYMENTS ────────────────
  // Manager rate = 100 (line amount = exact withholding amount; birRate used to back-calc tax base)
  // Name uses ATC-first format so ATC appears in all Manager reports, QAP, and 2307.
  { Name: 'WI010 – Prof. fees ≤3M (5%)',          Label: 'Individual – Prof. fees ≤3M',          birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI011 – Prof. fees >3M/VAT (10%)',     Label: 'Individual – Prof. fees >3M/VAT',      birRate: 10.0, managerRate: 100, group: 'EWT' },
  { Name: 'WI060 – Bookkeeping ≤3M (5%)',         Label: 'Individual – Bookkeeping ≤3M',         birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI061 – Bookkeeping >3M/VAT (10%)',    Label: 'Individual – Bookkeeping >3M/VAT',     birRate: 10.0, managerRate: 100, group: 'EWT' },
  { Name: 'WI100 – Rentals (5%)',                  Label: 'Individual – Rentals',                 birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI120 – Contractors (2%)',              Label: 'Individual – Contractors',             birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI150 – Medical >3M/VAT (10%)',         Label: 'Individual – Medical >3M/VAT',         birRate: 10.0, managerRate: 100, group: 'EWT' },
  { Name: 'WI151 – Medical ≤3M (5%)',              Label: 'Individual – Medical ≤3M',             birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI157 – Govt/GOCC services (2%)',       Label: 'Individual – Govt/GOCC services',      birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI158 – Top WA goods (1%)',             Label: 'Individual – Top WA goods',            birRate: 1.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI160 – Top WA services (2%)',          Label: 'Individual – Top WA services',         birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI630 – Minerals/quarry (5%)',          Label: 'Individual – Minerals/quarry',         birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WI640 – Govt/GOCC goods (1%)',          Label: 'Individual – Govt/GOCC goods',         birRate: 1.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC010 – Prof. fees ≤720K (10%)',        Label: 'Non-Individual – Prof. fees ≤720K',    birRate: 10.0, managerRate: 100, group: 'EWT' },
  { Name: 'WC011 – Prof. fees >720K (15%)',        Label: 'Non-Individual – Prof. fees >720K',    birRate: 15.0, managerRate: 100, group: 'EWT' },
  { Name: 'WC100 – Rentals (5%)',                  Label: 'Non-Individual – Rentals',             birRate: 5.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC120 – Contractors (2%)',              Label: 'Non-Individual – Contractors',         birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC157 – Govt/GOCC services (2%)',       Label: 'Non-Individual – Govt/GOCC services',  birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC158 – Top WA goods (1%)',             Label: 'Non-Individual – Top WA goods',        birRate: 1.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC160 – Top WA services (2%)',          Label: 'Non-Individual – Top WA services',     birRate: 2.0,  managerRate: 100, group: 'EWT' },
  { Name: 'WC640 – Govt/GOCC goods (1%)',          Label: 'Non-Individual – Govt/GOCC goods',     birRate: 1.0,  managerRate: 100, group: 'EWT' },

  // ── GROUP 3: EWT / CWT GOVERNMENT WITHHELD ───────────────
  { Name: 'WV012 – Govt WHT VAT Goods (5%)',       Label: 'Final withholding VAT on goods',       birRate: 5.0, managerRate: 100, group: 'GOVT' },
  { Name: 'WV022 – Govt WHT VAT Services (5%)',    Label: 'Final withholding VAT on services',    birRate: 5.0, managerRate: 100, group: 'GOVT' },
  { Name: 'WB080 – Govt WHT Percentage Tax (3%)',  Label: 'Sec. 109BB percentage tax',            birRate: 3.0, managerRate: 100, group: 'GOVT' },

  // ── GROUP 4: FINAL WITHHOLDING TAX ───────────────────────
  { Name: 'WI250 – Royalties Individual (20%)',    Label: 'FWT – Citizens, residents, NRAETB',         birRate: 20.0, managerRate: 100, group: 'FWT' },
  { Name: 'WC250 – Royalties Corporation (20%)',   Label: 'FWT – Domestic & resident foreign corps',   birRate: 20.0, managerRate: 100, group: 'FWT' },
];

// ── EWT / CWT ATC LIST ───────────────────────────────────────
// Used in the EWT/CWT mapping section of the Tax codes tab.
// Same codes appear on both purchases (EWT applied) and sales (CWT received).

const EWT_ATC_LIST = [
  // Individual
  { atc: 'WI010', desc: 'Professional fees, ≤3M',          rate: 5.0,  type: 'Individual' },
  { atc: 'WI011', desc: 'Professional fees, >3M/VAT',       rate: 10.0, type: 'Individual' },
  { atc: 'WI060', desc: 'Bookkeeping agents, ≤3M',          rate: 5.0,  type: 'Individual' },
  { atc: 'WI061', desc: 'Bookkeeping agents, >3M/VAT',      rate: 10.0, type: 'Individual' },
  { atc: 'WI100', desc: 'Rentals – property/personal',      rate: 5.0,  type: 'Individual' },
  { atc: 'WI120', desc: 'Contractors',                      rate: 2.0,  type: 'Individual' },
  { atc: 'WI150', desc: 'Medical practitioners, >3M/VAT',   rate: 10.0, type: 'Individual' },
  { atc: 'WI151', desc: 'Medical practitioners, ≤3M',       rate: 5.0,  type: 'Individual' },
  { atc: 'WI157', desc: 'Govt/GOCC supplier – services',    rate: 2.0,  type: 'Individual' },
  { atc: 'WI158', desc: 'Top WA supplier – goods',          rate: 1.0,  type: 'Individual' },
  { atc: 'WI160', desc: 'Top WA supplier – services',       rate: 2.0,  type: 'Individual' },
  { atc: 'WI630', desc: 'Minerals/quarry (non-BSP)',         rate: 5.0,  type: 'Individual' },
  { atc: 'WI640', desc: 'Govt/GOCC supplier – goods',       rate: 1.0,  type: 'Individual' },
  // Non-Individual
  { atc: 'WC010', desc: 'Professional fees, ≤720K',         rate: 10.0, type: 'Non-Individual' },
  { atc: 'WC011', desc: 'Professional fees, >720K',         rate: 15.0, type: 'Non-Individual' },
  { atc: 'WC100', desc: 'Rentals – property/personal',      rate: 5.0,  type: 'Non-Individual' },
  { atc: 'WC120', desc: 'Contractors',                      rate: 2.0,  type: 'Non-Individual' },
  { atc: 'WC157', desc: 'Govt/GOCC supplier – services',    rate: 2.0,  type: 'Non-Individual' },
  { atc: 'WC158', desc: 'Top WA supplier – goods',          rate: 1.0,  type: 'Non-Individual' },
  { atc: 'WC160', desc: 'Top WA supplier – services',       rate: 2.0,  type: 'Non-Individual' },
  { atc: 'WC640', desc: 'Govt/GOCC supplier – goods',       rate: 1.0,  type: 'Non-Individual' },
];

// ── FWT ATC LIST ─────────────────────────────────────────────
const FWT_ATC_LIST = [
  { atc: 'WI250', desc: 'Royalties – citizens, residents, NRAETB', rate: 20.0, type: 'Individual' },
  { atc: 'WC250', desc: 'Royalties – domestic & resident foreign corps', rate: 20.0, type: 'Non-Individual' },
];

// ── PERCENTAGE TAX ATC LIST ───────────────────────────────────
const PT_ATC_LIST = [
  { atc: 'WB080', desc: 'Persons exempt from VAT – Sec. 109BB (Govt withholding)', rate: 3.0 },
];

// ── VAT CATEGORIES ────────────────────────────────────────────
// Used in the VAT mapping section.
const VAT_CATEGORIES = [
  { key: 'sales_taxable',  label: 'Output VAT 12%',                    side: 'sales',    rate: 12.0 },
  { key: 'sales_zero',     label: 'Zero-Rated Sales',                  side: 'sales',    rate: 0    },
  { key: 'sales_exempt',   label: 'VAT Exempt Sales',                  side: 'sales',    rate: 0    },
  { key: 'purch_capital',  label: 'Input VAT 12% – Capital Goods',     side: 'purchase', rate: 12.0 },
  { key: 'purch_other',    label: 'Input VAT 12% – Other Goods',       side: 'purchase', rate: 12.0 },
  { key: 'purch_services', label: 'Input VAT 12% – Services',          side: 'purchase', rate: 12.0 },
  { key: 'purch_zero',     label: 'Zero-Rated Purchases',              side: 'purchase', rate: 0    },
  { key: 'purch_exempt',   label: 'VAT Exempt Purchases',              side: 'purchase', rate: 0    },
  { key: 'govt_wv012',     label: 'Govt Withholding VAT – Goods (WV012)',    side: 'purchase', rate: 5.0 },
  { key: 'govt_wv022',     label: 'Govt Withholding VAT – Services (WV022)', side: 'purchase', rate: 5.0 },
];
