/* ============================================================
   Tallo CPA – BIR Tax App
   batch-import.js  –  Converts a simple client-facing Excel
                        template into Customers/Suppliers and
                        Sales/Purchase Invoices (plus same-day
                        Receipts/Payments) by posting directly to
                        Manager's API (PUT, upsert-by-key) from
                        inside this iframe.

   Shared by two installable pages:
     batch-import-sales.html    sets BI_TXN_TYPE = 'Sale'
     batch-import-purchase.html sets BI_TXN_TYPE = 'Purchase'
   ============================================================ */

const BI_IS_SALE = (typeof BI_TXN_TYPE !== 'undefined' ? BI_TXN_TYPE : 'Sale') === 'Sale';
const BI_PARTY_LABEL = BI_IS_SALE ? 'Customer' : 'Supplier';

// ── SIMPLE CLIENT TEMPLATE (what the client/bookkeeper fills in) ──
// Both Sales and Purchase invoices are always tax-inclusive: VAT-category
// columns hold the gross (tax-inclusive) amount per category; withholding
// columns (CWT/WV for sales, Withholding Tax for purchases) are amounts
// withheld, recorded as negative lines. Chart of accounts (and, for
// purchases, ATC/withholding tax codes) vary per business, so the
// downloaded template includes extra reference sheets (fetched live for
// the selected business) to copy exact names from.
const BI_HEADERS = BI_IS_SALE ? [
  'Date (YYYY-MM-DD)', 'Customer Name', 'Reference', 'Revenue Account',
  'VATable Sales', 'VAT Exempt Sales', 'Zero-Rated Sales',
  'CWT Account', 'CWT Amount', 'WV Account', 'WV Amount',
  'Paid Same Day (Yes/No)', 'Paid Amount', 'Paid Date (YYYY-MM-DD)', 'Payment Account (Cash/Bank)',
] : [
  'Date (YYYY-MM-DD)', 'Supplier Name', 'Reference', 'Account',
  'Input VAT 12% (Capital Goods)', 'Input VAT 12% (Other Goods)', 'Input VAT 12% (Services)',
  'Zero-Rated Purchases', 'VAT Exempt Purchases',
  'Withholding Tax Account', 'ATC Code', 'Withholding Tax Amount',
  'Paid Same Day (Yes/No)', 'Paid Amount', 'Paid Date (YYYY-MM-DD)', 'Payment Account (Cash/Bank)',
];

const BI_SAMPLE_ROWS = BI_IS_SALE ? [
  ['2026-06-18', '48 Coffee Co.', 'INV-1001', 'Sales Revenue',
    5600, '', '',
    '', '', '', '',
    'Yes', 5600, '2026-06-18', 'Cash on Hand'],
] : [
  ['2026-06-18', 'ABC Trading', 'BILL-2001', 'Professional Fees',
    '', 2000, '',
    '', '',
    'Withholding Tax Payable', 'WI010 – Prof. fees ≤3M (5%)', 100,
    'No', '', '', ''],
];

let _biRows  = [];
let _biBiz   = '';
let _biCache = null;
let _biFile  = null;

async function initBatchImport() {
  const biz = await getReportBusiness(document.getElementById('biz-selector-wrap'));
  App.currentBusiness = biz;
  _biBiz = biz;

  document.getElementById('bi-template').addEventListener('click', downloadTemplate);
  document.getElementById('bi-upload-btn').addEventListener('click', () => document.getElementById('bi-file').click());
  document.getElementById('bi-file').addEventListener('change', handleFileChosen);
  document.getElementById('bi-validate').addEventListener('click', runValidation);
  document.getElementById('bi-post').addEventListener('click', postAllToManager);
}

// ── XLSX LOADING (lazy, used only for the template & reading uploads) ──
function ensureXLSX(cb) {
  if (window.XLSX) return cb();
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function downloadTemplate() {
  ensureXLSX(async () => {
    const cache = await buildLookupCache(_biBiz);
    const data = [BI_HEADERS, ...BI_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Batch Import');

    const coaRows = [['Account Title'], ...cache.accountList.map(a => [a.name]).sort((a, b) => a[0].localeCompare(b[0]))];
    const coaWs = XLSX.utils.aoa_to_sheet(coaRows);
    XLSX.utils.book_append_sheet(wb, coaWs, 'Chart of Accounts');

    if (!BI_IS_SALE) {
      const atcCodes = cache.taxCodes.filter(tc => /^W[ICVB]\d/.test(tc.name)).map(tc => [tc.name]).sort((a, b) => a[0].localeCompare(b[0]));
      const atcWs = XLSX.utils.aoa_to_sheet([['ATC Code (Tax Code Name)'], ...atcCodes]);
      XLSX.utils.book_append_sheet(wb, atcWs, 'ATC Codes');
    }

    XLSX.writeFile(wb, `batch_import_${BI_IS_SALE ? 'sales' : 'purchase'}_template.xlsx`);
  });
}

function handleFileChosen(e) {
  _biFile = e.target.files[0] || null;
  document.getElementById('bi-filename').textContent = _biFile ? _biFile.name : '';
  document.getElementById('bi-validate').style.display = _biFile ? '' : 'none';
  document.getElementById('bi-post').style.display = 'none';
  document.getElementById('bi-output').innerHTML = '';
}

// ── LOOKUP CACHE (account/tax-code/contact name -> Manager key) ──
async function buildLookupCache(biz) {
  if (_biCache && _biCache.biz === biz) return _biCache;
  const [taxCodes, bsAccounts, plAccounts, parties] = await Promise.all([
    fetchManagerTaxCodes(biz),
    fetchAllBatch('/api4/balance-sheet-account-batch', biz).catch(() => []),
    fetchAllBatch('/api4/profit-and-loss-statement-account-batch', biz).catch(() => []),
    fetchAllBatch(BI_IS_SALE ? '/api4/customer-batch' : '/api4/supplier-batch', biz),
  ]);
  const accounts = [...bsAccounts, ...plAccounts];
  const keyMap = arr => {
    const m = new Map();
    arr.forEach(row => {
      const d = row?.item || row?.value || row || {};
      const n = (d.name || d.Name || '').trim().toLowerCase();
      const k = row?.key || row?.Key || d.key || '';
      if (n && k) m.set(n, k);
    });
    return m;
  };
  const accountList = accounts.map(row => {
    const d = row?.item || row?.value || row || {};
    return { name: (d.name || d.Name || '').trim(), key: row?.key || row?.Key || d.key || '' };
  }).filter(a => a.name && a.key);
  const taxCodeKeyByName = new Map(taxCodes.map(tc => [tc.name.trim().toLowerCase(), tc.key]));
  _biCache = {
    biz,
    taxCodes,
    taxCodeKeyByName,
    accountKeyByName: keyMap(accounts),
    accountList,
    partyKeyByName: keyMap(parties),
  };
  return _biCache;
}

// ── PARSE + VALIDATE ─────────────────────────────────────────
async function runValidation() {
  if (!_biFile) return;
  ensureXLSX(async () => {
    document.getElementById('bi-output').innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Reading file…</span></div>`;
    const buf = await _biFile.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const dataRows = aoa.slice(1).filter(r => r.some(c => String(c).trim() !== ''));

    document.getElementById('bi-output').innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Checking against Manager accounts, tax codes &amp; contacts…</span></div>`;
    const cache = await buildLookupCache(_biBiz);

    _biRows = dataRows.map((r, idx) => parseRow(r, idx, cache));
    renderPreview();
  });
}

function parseRow(r, idx, cache) {
  return BI_IS_SALE ? parseSaleRow(r, idx, cache) : parsePurchaseRow(r, idx, cache);
}

function checkAccount(errors, label, acctName, cache) {
  if (cache.accountKeyByName.size && !cache.accountKeyByName.has(acctName.trim().toLowerCase())) {
    errors.push(`${label} account "${acctName}" not found in Manager — check spelling against the Chart of Accounts sheet`);
  }
}

function parseSaleRow(r, idx, cache) {
  const errors = [];
  const get = i => (r[i] !== undefined ? String(r[i]).trim() : '');
  const num = i => parseFloat(get(i)) || 0;

  const row = {
    rowNum: idx + 2,
    date: get(0),
    partyName: get(1),
    reference: get(2),
    amountsIncludeTax: true,
    lines: [],
    paid: /^y/i.test(get(11)),
    paidAmount: parseFloat(get(12)) || 0,
    paidDate: get(13),
    paymentAccount: get(14),
  };

  const revenueAcctName = get(3);
  const vatable    = num(4);
  const exempt     = num(5);
  const zeroRated  = num(6);
  const cwtAcctName = get(7);
  const cwt        = num(8);
  const wvAcctName  = get(9);
  const wv         = num(10);

  const resolveAcct = (name, label) => {
    if (!name) { errors.push(`${label} account is blank — copy an Account Title from the Chart of Accounts sheet`); return null; }
    const key = cache.accountKeyByName.get(name.trim().toLowerCase());
    if (!key) errors.push(`${label} account "${name}" not found in Manager — check spelling against the Chart of Accounts sheet`);
    return key || null;
  };

  const revenueAcctKey = (vatable > 0 || exempt > 0 || zeroRated > 0) ? resolveAcct(revenueAcctName, 'Revenue') : null;

  if (vatable > 0)   row.lines.push({ acctKey: revenueAcctKey, acctName: revenueAcctName || 'Revenue', amount: vatable, tcName: 'Output VAT 12%' });
  if (exempt > 0)    row.lines.push({ acctKey: revenueAcctKey, acctName: revenueAcctName || 'Revenue', amount: exempt, tcName: 'VAT Exempt Sales' });
  if (zeroRated > 0) row.lines.push({ acctKey: revenueAcctKey, acctName: revenueAcctName || 'Revenue', amount: zeroRated, tcName: 'Zero-Rated Sales' });
  if (cwt > 0)       row.lines.push({ acctKey: resolveAcct(cwtAcctName, 'CWT'), acctName: cwtAcctName || 'CWT', amount: -cwt, tcName: null });
  if (wv > 0)        row.lines.push({ acctKey: resolveAcct(wvAcctName, 'WV'), acctName: wvAcctName || 'WV', amount: -wv, tcName: null });

  ['Output VAT 12%', 'VAT Exempt Sales', 'Zero-Rated Sales'].forEach(tc => {
    if (row.lines.some(l => l.tcName === tc) && !cache.taxCodeKeyByName.has(tc.toLowerCase())) {
      errors.push(`Tax code "${tc}" not found in Manager — install standard tax codes from the Tax Codes tab`);
    }
  });

  if (!row.date || isNaN(new Date(row.date).getTime())) errors.push(`Date is missing/invalid`);
  if (!row.partyName) errors.push(`${BI_PARTY_LABEL} name is blank`);
  if (vatable === 0 && exempt === 0 && zeroRated === 0) errors.push(`No sales amount entered (VATable / VAT Exempt / Zero-Rated Sales)`);

  row.partyMissing = !!row.partyName && !cache.partyKeyByName.has(row.partyName.trim().toLowerCase());

  if (row.paid) {
    if (!row.paidAmount) errors.push(`Paid = Yes but Paid Amount is blank`);
    if (!row.paidDate || isNaN(new Date(row.paidDate).getTime())) errors.push(`Paid = Yes but Paid Date is missing/invalid`);
    if (!row.paymentAccount) errors.push(`Paid = Yes but Payment Account is blank`);
    else checkAccount(errors, 'Payment', row.paymentAccount, cache);
  }

  row.errors = errors;
  row.status = errors.length ? 'error' : (row.partyMissing ? 'warn' : 'ok');
  row.posted = false;
  return row;
}

function parsePurchaseRow(r, idx, cache) {
  const errors = [];
  const get = i => (r[i] !== undefined ? String(r[i]).trim() : '');
  const num = i => parseFloat(get(i)) || 0;

  const row = {
    rowNum: idx + 2,
    date: get(0),
    partyName: get(1),
    reference: get(2),
    amountsIncludeTax: true,
    lines: [],
    paid: /^y/i.test(get(12)),
    paidAmount: parseFloat(get(13)) || 0,
    paidDate: get(14),
    paymentAccount: get(15),
  };

  const acctName    = get(3);
  const capGoods    = num(4);
  const otherGoods  = num(5);
  const services    = num(6);
  const zeroRated   = num(7);
  const exempt      = num(8);
  const whtAcctName = get(9);
  const atcCode     = get(10);
  const whtAmount   = num(11);

  const resolveAcct = (name, label) => {
    if (!name) { errors.push(`${label} account is blank — copy an Account Title from the Chart of Accounts sheet`); return null; }
    const key = cache.accountKeyByName.get(name.trim().toLowerCase());
    if (!key) errors.push(`${label} account "${name}" not found in Manager — check spelling against the Chart of Accounts sheet`);
    return key || null;
  };

  const hasCategoryAmount = capGoods > 0 || otherGoods > 0 || services > 0 || zeroRated > 0 || exempt > 0;
  const acctKey = hasCategoryAmount ? resolveAcct(acctName, 'Account') : null;

  if (capGoods > 0)   row.lines.push({ acctKey, acctName: acctName || 'Account', amount: capGoods,   tcName: 'Input VAT 12% (Capital Goods)' });
  if (otherGoods > 0) row.lines.push({ acctKey, acctName: acctName || 'Account', amount: otherGoods, tcName: 'Input VAT 12% (Other Goods)' });
  if (services > 0)   row.lines.push({ acctKey, acctName: acctName || 'Account', amount: services,   tcName: 'Input VAT 12% (Services)' });
  if (zeroRated > 0)  row.lines.push({ acctKey, acctName: acctName || 'Account', amount: zeroRated,  tcName: 'Zero-Rated Purchases' });
  if (exempt > 0)     row.lines.push({ acctKey, acctName: acctName || 'Account', amount: exempt,     tcName: 'VAT Exempt Purchases' });

  ['Input VAT 12% (Capital Goods)', 'Input VAT 12% (Other Goods)', 'Input VAT 12% (Services)', 'Zero-Rated Purchases', 'VAT Exempt Purchases'].forEach(tc => {
    if (row.lines.some(l => l.tcName === tc) && !cache.taxCodeKeyByName.has(tc.toLowerCase())) {
      errors.push(`Tax code "${tc}" not found in Manager — install standard tax codes from the Tax Codes tab`);
    }
  });

  if (whtAmount > 0) {
    const whtAcctKey = resolveAcct(whtAcctName, 'Withholding Tax');
    let atcKey = null;
    if (!atcCode) errors.push(`ATC Code is blank — copy one from the ATC Codes sheet`);
    else {
      atcKey = cache.taxCodeKeyByName.get(atcCode.trim().toLowerCase()) || null;
      if (!atcKey) errors.push(`ATC Code "${atcCode}" not found in Manager — check spelling against the ATC Codes sheet`);
    }
    row.lines.push({ acctKey: whtAcctKey, acctName: whtAcctName || 'Withholding Tax', amount: -whtAmount, tcName: atcCode, tcKey: atcKey });
  }

  if (!row.date || isNaN(new Date(row.date).getTime())) errors.push(`Date is missing/invalid`);
  if (!row.partyName) errors.push(`${BI_PARTY_LABEL} name is blank`);
  if (!hasCategoryAmount) errors.push(`No purchase amount entered (Capital Goods / Other Goods / Services / Zero-Rated / Exempt)`);

  row.partyMissing = !!row.partyName && !cache.partyKeyByName.has(row.partyName.trim().toLowerCase());

  if (row.paid) {
    if (!row.paidAmount) errors.push(`Paid = Yes but Paid Amount is blank`);
    if (!row.paidDate || isNaN(new Date(row.paidDate).getTime())) errors.push(`Paid = Yes but Paid Date is missing/invalid`);
    if (!row.paymentAccount) errors.push(`Paid = Yes but Payment Account is blank`);
    else checkAccount(errors, 'Payment', row.paymentAccount, cache);
  }

  row.errors = errors;
  row.status = errors.length ? 'error' : (row.partyMissing ? 'warn' : 'ok');
  row.posted = false;
  return row;
}

// ── PREVIEW ───────────────────────────────────────────────────
function renderPreview() {
  const out = document.getElementById('bi-output');
  const okCount  = _biRows.filter(r => r.status !== 'error').length;
  const errCount = _biRows.filter(r => r.status === 'error').length;
  const newParty = _biRows.filter(r => r.partyMissing).length;

  const rowsHtml = _biRows.map((r, i) => `
    <tr class="row-${r.status}" id="bi-row-${i}">
      <td>${r.rowNum}</td>
      <td>${escHtml(r.date)}</td>
      <td>${escHtml(r.partyName)}${r.partyMissing ? ' <span style="color:#92400e;">(will create)</span>' : ''}</td>
      <td>${escHtml(r.reference)}</td>
      <td>${r.lines.map(l => `${escHtml(l.acctName)}: ${fmt(l.amount)}${l.tcName ? ' ['+escHtml(l.tcName)+']' : ''}`).join('<br>')}</td>
      <td>${r.paid ? `Yes — ${fmt(r.paidAmount)} on ${escHtml(r.paidDate)} (${escHtml(r.paymentAccount)})` : 'No'}</td>
      <td class="bi-status-cell">${r.errors.length ? `<div class="bi-err">${r.errors.map(escHtml).join('<br>')}</div>` : (r.partyMissing ? '⚠️ New contact' : '✅ OK')}</td>
    </tr>`).join('');

  out.innerHTML = `
    <div style="margin-bottom:10px;">
      <span class="bi-stat"><b>${_biRows.length}</b> rows</span>
      <span class="bi-stat" style="color:#16a34a;"><b>${okCount}</b> ready</span>
      <span class="bi-stat" style="color:#c0392b;"><b>${errCount}</b> with errors</span>
      <span class="bi-stat" style="color:#92400e;"><b>${newParty}</b> new ${BI_PARTY_LABEL.toLowerCase()}</span>
    </div>
    <div class="bi-wrap">
      <table class="bi-table">
        <thead><tr><th>#</th><th>Date</th><th>${BI_PARTY_LABEL}</th><th>Ref</th><th>Lines</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div id="bi-post-summary"></div>`;

  document.getElementById('bi-post').style.display = okCount > 0 ? '' : 'none';
}

function setRowStatus(idx, html) {
  const cell = document.querySelector(`#bi-row-${idx} .bi-status-cell`);
  if (cell) cell.innerHTML = html;
}

// ── POST DIRECTLY TO MANAGER VIA API ───────────────────────────
async function ensureParty(name, cache) {
  const lname = name.trim().toLowerCase();
  const existing = cache.partyKeyByName.get(lname);
  if (existing) return existing;

  const key = crypto.randomUUID();
  await apiRequest('PUT', BI_IS_SALE ? '/api4/customer' : '/api4/supplier', {
    key,
    value: { name: name.trim(), inactive: false },
  });
  cache.partyKeyByName.set(lname, key);
  return key;
}

async function postInvoiceRow(row, cache) {
  const partyKey = await ensureParty(row.partyName, cache);

  const lines = row.lines.map(l => {
    const line = {
      account: l.acctKey || cache.accountKeyByName.get(l.acctName.trim().toLowerCase()) || null,
      qty: 1,
      taxCode: l.tcKey !== undefined ? l.tcKey : (l.tcName ? (cache.taxCodeKeyByName.get(l.tcName.trim().toLowerCase()) || null) : null),
    };
    line[BI_IS_SALE ? 'salesUnitPrice' : 'purchaseUnitPrice'] = l.amount;
    return line;
  });

  const invoiceKey = crypto.randomUUID();
  const value = {
    issueDate: row.date,
    reference: row.reference || null,
    amountsIncludeTax: !!row.amountsIncludeTax,
    lines,
  };
  value[BI_IS_SALE ? 'customer' : 'supplier'] = partyKey;

  await apiRequest('PUT', BI_IS_SALE ? '/api4/sales-invoice' : '/api4/purchase-invoice', { key: invoiceKey, value });

  if (row.paid) {
    const paymentAcctKey = cache.accountKeyByName.get(row.paymentAccount.trim().toLowerCase()) || null;
    const settleKey = crypto.randomUUID();
    if (BI_IS_SALE) {
      await apiRequest('PUT', '/api4/receipt', {
        key: settleKey,
        value: {
          date: row.paidDate,
          reference: row.reference || null,
          receivedIn: paymentAcctKey,
          paidBy: 'Customer',
          customer: partyKey,
          lines: [{
            accountsReceivableCustomer: partyKey,
            accountsReceivableSalesInvoice: invoiceKey,
            amount: row.paidAmount,
          }],
        },
      });
    } else {
      await apiRequest('PUT', '/api4/payment', {
        key: settleKey,
        value: {
          date: row.paidDate,
          reference: row.reference || null,
          paidFrom: paymentAcctKey,
          payee: 'Supplier',
          supplier: partyKey,
          lines: [{
            accountsPayableSupplier: partyKey,
            purchaseInvoice: invoiceKey,
            amount: row.paidAmount,
          }],
        },
      });
    }
  }

  return invoiceKey;
}

async function postAllToManager() {
  const cache = await buildLookupCache(_biBiz);
  const okIdx = _biRows.map((r, i) => i).filter(i => _biRows[i].status !== 'error' && !_biRows[i].posted);

  document.getElementById('bi-post').disabled = true;
  let successCount = 0;
  const failures = [];

  for (const i of okIdx) {
    const row = _biRows[i];
    setRowStatus(i, `<div class="spinner-wrap" style="justify-content:flex-start;"><div class="spinner" style="width:14px;height:14px;"></div><span>Posting…</span></div>`);
    try {
      await postInvoiceRow(row, cache);
      row.posted = true;
      successCount++;
      setRowStatus(i, '✅ Posted to Manager' + (row.paid ? ' + settled' : ''));
    } catch (err) {
      failures.push({ rowNum: row.rowNum, message: err.message });
      setRowStatus(i, `<div class="bi-err">❌ Failed: ${escHtml(err.message)}</div>`);
    }
  }

  document.getElementById('bi-post').disabled = false;
  const summary = document.getElementById('bi-post-summary');
  summary.innerHTML = `
    <div class="alert ${failures.length ? 'alert-warning' : 'alert-info'}" style="margin-top:14px;">
      ${failures.length
        ? `⚠️ Posted <strong>${successCount}</strong> of <strong>${okIdx.length}</strong> rows. <strong>${failures.length}</strong> failed — see row(s) above for the error, fix the source data, and click "Post to Manager" again to retry just the failed rows.`
        : `✅ Posted <strong>${successCount}</strong> row(s) to Manager — ${BI_PARTY_LABEL}s created as needed, then Invoices, then ${BI_IS_SALE ? 'Receipts' : 'Payments'} for rows marked Paid Same Day.`}
    </div>`;
}
