// Philippines BIR — Standard tax code templates + mapping definitions.
// TAX_CODE_TEMPLATES: codes to create in Manager (one-click from Tax codes tab).
// EWT_ATC_LIST: curated ATC codes for EWT/CWT mapping section.
// FWT_ATC_LIST: FWT codes for FWT mapping section.
// PT_ATC_LIST: Percentage Tax codes for PT mapping section.

// ── TAX CODE TEMPLATES ───────────────────────────────────────
// app.js reads this to show status per business and offer one-click Create.

const TAX_CODE_TEMPLATES = [

  // VALUE ADDED TAX
  { Name: 'Output VAT 12%',                  Label: 'Standard VATable sales',                         Rate: 12.0, group: 'VAT' },
  { Name: 'Input VAT 12%',                   Label: 'Standard VATable purchases',                     Rate: 12.0, group: 'VAT' },
  { Name: 'Input VAT 12% (Capital Goods)',   Label: 'Capital expenditure purchases',                  Rate: 12.0, group: 'VAT' },
  { Name: 'Zero-Rated Sales',                Label: 'Export / PEZA / zero-rated',                     Rate: 0,    group: 'VAT' },
  { Name: 'VAT Exempt Sales',                Label: 'Sales exempt from VAT',                          Rate: 0,    group: 'VAT' },
  { Name: 'Zero-Rated Purchases',            Label: 'Zero-rated purchase inputs',                     Rate: 0,    group: 'VAT' },
  { Name: 'VAT Exempt Purchases',            Label: 'Exempt purchase inputs',                         Rate: 0,    group: 'VAT' },
  { Name: 'Govt Withholding VAT - Goods',    Label: 'WV012 – VAT withholding on purchases of goods',  Rate: 5.0,  group: 'VAT' },
  { Name: 'Govt Withholding VAT - Services', Label: 'WV022 – VAT withholding on purchases of services', Rate: 5.0, group: 'VAT' },

  // PERCENTAGE TAX
  { Name: 'Percentage Tax 3%',               Label: 'For non-VAT registered taxpayers',               Rate: 3.0,  group: 'Percentage Tax' },
  { Name: 'Govt Withholding PT 3%',          Label: 'WB080 – Sec. 109BB government withholding',      Rate: 3.0,  group: 'Percentage Tax' },

  // EXPANDED WITHHOLDING TAX — INDIVIDUAL
  { Name: 'EWT 5% – Prof. fees ≤3M',         Label: 'WI010 – Individual',  Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 10% – Prof. fees >3M/VAT',    Label: 'WI011 – Individual',  Rate: 10.0, group: 'EWT' },
  { Name: 'EWT 5% – Bookkeeping ≤3M',        Label: 'WI060 – Individual',  Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 10% – Bookkeeping >3M/VAT',   Label: 'WI061 – Individual',  Rate: 10.0, group: 'EWT' },
  { Name: 'EWT 5% – Rentals',                Label: 'WI100 – Individual',  Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 2% – Contractors',            Label: 'WI120 – Individual',  Rate: 2.0,  group: 'EWT' },
  { Name: 'EWT 10% – Medical >3M/VAT',       Label: 'WI150 – Individual',  Rate: 10.0, group: 'EWT' },
  { Name: 'EWT 5% – Medical ≤3M',            Label: 'WI151 – Individual',  Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 2% – Govt/GOCC services',     Label: 'WI157 – Individual',  Rate: 2.0,  group: 'EWT' },
  { Name: 'EWT 1% – Top WA goods',           Label: 'WI158 – Individual',  Rate: 1.0,  group: 'EWT' },
  { Name: 'EWT 2% – Top WA services',        Label: 'WI160 – Individual',  Rate: 2.0,  group: 'EWT' },
  { Name: 'EWT 5% – Minerals/quarry',        Label: 'WI630 – Individual',  Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 1% – Govt/GOCC goods',        Label: 'WI640 – Individual',  Rate: 1.0,  group: 'EWT' },

  // EXPANDED WITHHOLDING TAX — NON-INDIVIDUAL
  { Name: 'EWT 10% – Prof. fees ≤720K',      Label: 'WC010 – Non-Individual', Rate: 10.0, group: 'EWT' },
  { Name: 'EWT 15% – Prof. fees >720K',      Label: 'WC011 – Non-Individual', Rate: 15.0, group: 'EWT' },
  { Name: 'EWT 5% – Rentals (corp)',          Label: 'WC100 – Non-Individual', Rate: 5.0,  group: 'EWT' },
  { Name: 'EWT 2% – Contractors (corp)',      Label: 'WC120 – Non-Individual', Rate: 2.0,  group: 'EWT' },
  { Name: 'EWT 2% – Govt/GOCC services (corp)', Label: 'WC157 – Non-Individual', Rate: 2.0, group: 'EWT' },
  { Name: 'EWT 1% – Top WA goods (corp)',     Label: 'WC158 – Non-Individual', Rate: 1.0,  group: 'EWT' },
  { Name: 'EWT 2% – Top WA services (corp)', Label: 'WC160 – Non-Individual', Rate: 2.0,  group: 'EWT' },
  { Name: 'EWT 1% – Govt/GOCC goods (corp)', Label: 'WC640 – Non-Individual', Rate: 1.0,  group: 'EWT' },

  // FINAL WITHHOLDING TAX
  { Name: 'FWT 20% – Royalties (individual)',    Label: 'WI250 – Citizens, residents, NRAETB', Rate: 20.0, group: 'FWT' },
  { Name: 'FWT 20% – Royalties (corporation)',   Label: 'WC250 – Domestic & resident foreign corps', Rate: 20.0, group: 'FWT' },
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
