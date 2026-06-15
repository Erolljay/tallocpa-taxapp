/* ============================================================
   Tallo CPA – BIR Tax App
   sls-report.js  –  Summary List of Sales and Purchases
                     with DAT download and Excel export
   ============================================================ */

let _slRows = [];

async function initSLReport(type) {
  const filterEl = document.getElementById('filter-area');
  const outputEl = document.getElementById('report-output');
  const isSLS    = type === 'sls';

  // Detect business from Manager context
  let biz;
  try {
    biz = await getReportBusiness(document.getElementById('biz-selector-wrap'));
    App.currentBusiness = biz;
  } catch(e) {
    outputEl.innerHTML = `<div class="alert alert-warn">⚠️ Could not connect to Manager: ${escHtml(e.message)}</div>`;
    return;
  }

  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading business setup…</span></div>`;
  const setup = await loadSetup(biz);

  if (!setup) {
    outputEl.innerHTML = `<div class="alert alert-warn">⚠️ Business info not configured. Fill in the <strong>Business</strong> tab in the Tallo CPA extension first.</div>`;
    return;
  }
  outputEl.innerHTML = '';

  const now  = new Date();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);
  const curY = now.getFullYear();
  const years = [curY - 2, curY - 1, curY, curY + 1];

  filterEl.innerHTML = `
    <div class="filter-bar">
      <label>Period</label>
      <select id="sl-ptype">
        <option value="quarterly">Quarterly</option>
        <option value="monthly">Monthly</option>
      </select>
      <span id="sl-qwrap">
        <label>Quarter</label>
        <select id="sl-quarter">
          ${[1,2,3,4].map(q=>`<option value="${q}"${q===curQ?' selected':''}>${quarterLabel(q)}</option>`).join('')}
        </select>
      </span>
      <span id="sl-mwrap" style="display:none;">
        <label>Month</label>
        <select id="sl-month">
          ${[0,1,2,3,4,5,6,7,8,9,10,11].map(m=>`<option value="${m}"${m===now.getMonth()?' selected':''}>${monthName(m)}</option>`).join('')}
        </select>
      </span>
      <label>Year</label>
      <select id="sl-year">
        ${years.map(y=>`<option value="${y}"${y===curY?' selected':''}>${y}</option>`).join('')}
      </select>
      <div class="filter-sep"></div>
      <button class="btn btn-primary" id="sl-gen">⚡ Generate</button>
      <button class="btn btn-outline"  id="sl-excel" style="display:none;">📥 Excel</button>
      <button class="btn btn-outline"  id="sl-dat"   style="display:none;">📄 DAT File</button>
      <button class="btn btn-outline"  id="sl-print" style="display:none;" onclick="window.print()">🖨 Print</button>
    </div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">
      Business: <strong>${escHtml(biz)}</strong> &nbsp;|&nbsp;
      TIN: <strong>${escHtml(setup.tin||'—')}</strong>
    </div>`;

  document.getElementById('sl-ptype').addEventListener('change', function () {
    const isM = this.value === 'monthly';
    document.getElementById('sl-qwrap').style.display = isM ? 'none' : '';
    document.getElementById('sl-mwrap').style.display = isM ? '' : 'none';
  });

  document.getElementById('sl-gen').addEventListener('click', () => generateSL(type, biz, setup, outputEl));

  // Customers/Suppliers quick-edit tab
  const partyType = isSLS ? 'customer' : 'supplier';
  const partyTab  = isSLS ? 'customers' : 'suppliers';
  let partyController = null;
  document.getElementById('sl-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('#sl-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
    if (tab === partyTab) {
      const container = document.getElementById(`tab-${partyTab}`);
      if (!partyController) partyController = CF.mountParty(container, partyType);
      partyController.refresh().then(() => filterPartyTabToPeriod(container));
    }
  });
}

// Hide rows for customers/suppliers that have no transactions in the
// currently-generated SLS/SLP period, so the tab only shows the
// parties relevant to that period's report.
function filterPartyTabToPeriod(container) {
  if (!_slRows.length) return;
  const keys = new Set(_slRows.map(r => r.partyKey).filter(Boolean));
  if (!keys.size) return;
  let shown = 0, total = 0;
  container.querySelectorAll('tbody tr[data-key]').forEach(tr => {
    total++;
    const visible = keys.has(tr.dataset.key);
    tr.style.display = visible ? '' : 'none';
    if (visible) shown++;
  });
  const countEl = container.querySelector('[id$="-count"]');
  if (countEl) countEl.textContent = `${shown} of ${total} records have transactions in the selected period`;
}

async function generateSL(type, biz, setup, outputEl) {
  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Fetching transactions…</span></div>`;
  const isSLS = type === 'sls';
  const ptypeEl = document.getElementById('sl-ptype');
  const ptype   = ptypeEl ? ptypeEl.value : 'quarterly';
  const year    = parseInt(document.getElementById('sl-year').value, 10);
  const period  = ptype === 'monthly'
    ? parseInt(document.getElementById('sl-month').value, 10)
    : parseInt(document.getElementById('sl-quarter').value, 10);

  const { start, end } = getPeriodDates(ptype, period, year);
  const { vm } = await getVatMapping(biz);

  try {
    const rows = isSLS
      ? await buildSLSRows(biz, start, end, vm)
      : await buildSLPRows(biz, start, end, vm);

    _slRows = rows;

    const periodLabel = ptype === 'monthly'
      ? `${monthName(period)} ${year}`
      : `${quarterLabel(period)} ${year}`;

    renderSLTable(outputEl, rows, type, periodLabel, setup);

    ['sl-excel','sl-dat','sl-print'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = '';
    });

    document.getElementById('sl-excel').onclick = () => exportExcel(rows, type, periodLabel, setup, end);
    document.getElementById('sl-dat').onclick   = () => exportDAT(rows, type, setup, end);

  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

// ── BUILD ROWS ────────────────────────────────────────────────
async function buildSLSRows(biz, start, end, vm) {
  const [invItems, receiptItems, custMap] = await Promise.all([
    fetchAllBatch('/api4/sales-invoice-batch', biz),
    fetchAllBatch('/api4/receipt-batch', biz),
    loadPartyBIR(biz, 'customer'),
  ]);
  // Include cash-sale receipts that carry a VAT tax code directly on their lines
  const items = [...invItems, ...receiptItems.filter(({ item }) => (item?.Lines || []).some(l => l?.TaxCode))];
  const rows    = [];

  for (const { key: invKey, item } of items) {
    if (!inRange(item?.Date, start, end)) continue;
    const ck   = item?.Customer || '';
    const cd   = custMap[ck] || {};
    const name = cd.companyName || [cd.lastName, cd.firstName, cd.middleName].filter(Boolean).join(', ') || item?.CustomerName || ck;

    let taxable = 0, zeroRated = 0, exempt = 0, outputVAT = 0;
    for (const line of (item?.Lines || [])) {
      const tc  = line?.TaxCode || '';
      const amt = Math.abs(Number(line?.Amount || 0));
      const tax = Math.abs(Number(line?.Tax || 0));
      if (tc && tc === vm.sales_taxable)      { taxable   += amt; outputVAT += tax || amt * 0.12; }
      else if (tc && tc === vm.sales_zero)    { zeroRated += amt; }
      else if (tc && tc === vm.sales_exempt)  { exempt    += amt; }
    }
    if (taxable + zeroRated + exempt === 0) continue;
    rows.push({
      date: item.Date, reference: item.Reference || item.InvoiceNumber || '',
      partyKey: ck,
      name, tin: cd.tin || '', address: [cd.address1, cd.address2].filter(Boolean).join(', '),
      companyName: cd.companyName || '', lastName: cd.lastName || '', firstName: cd.firstName || '', middleName: cd.middleName || '',
      address1: cd.address1 || '', address2: cd.address2 || '',
      taxable, zeroRated, exempt, outputVAT,
      total: taxable + zeroRated + exempt,
    });
  }
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function buildSLPRows(biz, start, end, vm) {
  const [invItems, paymentItems, suppMap] = await Promise.all([
    fetchAllBatch('/api4/purchase-invoice-batch', biz),
    fetchAllBatch('/api4/payment-batch', biz),
    loadPartyBIR(biz, 'supplier'),
  ]);
  // Include cash-purchase/expense payments that carry a VAT tax code directly on their lines
  const items = [...invItems, ...paymentItems.filter(({ item }) => (item?.Lines || []).some(l => l?.TaxCode))];
  const rows    = [];

  for (const { key: invKey, item } of items) {
    if (!inRange(item?.Date, start, end)) continue;
    const sk   = item?.Supplier || '';
    const sd   = suppMap[sk] || {};
    const name = sd.companyName || [sd.lastName, sd.firstName, sd.middleName].filter(Boolean).join(', ') || item?.SupplierName || sk;

    let capGoods = 0, otherGoods = 0, services = 0, zeroRated = 0, exempt = 0, inputVAT = 0;
    for (const line of (item?.Lines || [])) {
      const tc  = line?.TaxCode || '';
      const amt = Math.abs(Number(line?.Amount || 0));
      const tax = Math.abs(Number(line?.Tax || 0));
      if (tc && tc === vm.purch_capital)      { capGoods  += amt; inputVAT += tax || amt * 0.12; }
      else if (tc && tc === vm.purch_other)   { otherGoods += amt; inputVAT += tax || amt * 0.12; }
      else if (tc && tc === vm.purch_services){ services   += amt; inputVAT += tax || amt * 0.12; }
      else if (tc && tc === vm.purch_zero)    { zeroRated  += amt; }
      else if (tc && tc === vm.purch_exempt)  { exempt     += amt; }
    }
    if (capGoods + otherGoods + services + zeroRated + exempt === 0) continue;
    rows.push({
      date: item.Date, reference: item.Reference || item.InvoiceNumber || '',
      partyKey: sk,
      name, tin: sd.tin || '', address: [sd.address1, sd.address2].filter(Boolean).join(', '),
      companyName: sd.companyName || '', lastName: sd.lastName || '', firstName: sd.firstName || '', middleName: sd.middleName || '',
      address1: sd.address1 || '', address2: sd.address2 || '',
      capGoods, otherGoods, services, zeroRated, exempt, inputVAT,
      total: capGoods + otherGoods + services + zeroRated + exempt,
    });
  }
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ── RENDER TABLE ──────────────────────────────────────────────
function renderSLTable(el, rows, type, periodLabel, setup) {
  const isSLS = type === 'sls';
  if (rows.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>No Transactions Found</h3>
      <p>No ${isSLS?'sales':'purchase'} invoices matched your VAT mapping for this period.</p></div>`;
    return;
  }

  const tot = rows.reduce((a, r) => {
    if (isSLS) return { ...a, taxable: a.taxable+r.taxable, zeroRated: a.zeroRated+r.zeroRated, exempt: a.exempt+r.exempt, vat: a.vat+r.outputVAT };
    return { ...a, cap: a.cap+r.capGoods, other: a.other+r.otherGoods, svc: a.svc+r.services, zr: a.zr+r.zeroRated, ex: a.ex+r.exempt, vat: a.vat+r.inputVAT };
  }, { taxable:0, zeroRated:0, exempt:0, vat:0, cap:0, other:0, svc:0, zr:0, ex:0 });

  const slsHead = `<th>Date</th><th>Invoice No.</th><th>Buyer Name</th><th>TIN</th>
    <th class="num">Taxable</th><th class="num">Zero-Rated</th><th class="num">Exempt</th><th class="num">Output VAT</th>`;
  const slpHead = `<th>Date</th><th>Invoice No.</th><th>Seller Name</th><th>TIN</th>
    <th class="num">Capital Goods</th><th class="num">Other Goods</th><th class="num">Services</th>
    <th class="num">Zero-Rated</th><th class="num">Exempt</th><th class="num">Input VAT</th>`;

  const slsRow = r => `<tr>
    <td>${fmtDate(r.date)}</td><td>${escHtml(r.reference)}</td><td>${escHtml(r.name)}</td>
    <td style="font-family:monospace;">${escHtml(r.tin)}</td>
    <td class="num">${fmt(r.taxable)}</td><td class="num">${fmt(r.zeroRated)}</td>
    <td class="num">${fmt(r.exempt)}</td><td class="num">${fmt(r.outputVAT)}</td></tr>`;

  const slpRow = r => `<tr>
    <td>${fmtDate(r.date)}</td><td>${escHtml(r.reference)}</td><td>${escHtml(r.name)}</td>
    <td style="font-family:monospace;">${escHtml(r.tin)}</td>
    <td class="num">${fmt(r.capGoods)}</td><td class="num">${fmt(r.otherGoods)}</td>
    <td class="num">${fmt(r.services)}</td><td class="num">${fmt(r.zeroRated)}</td>
    <td class="num">${fmt(r.exempt)}</td><td class="num">${fmt(r.inputVAT)}</td></tr>`;

  const slsFoot = `<td colspan="4" style="font-weight:700;">TOTALS</td>
    <td class="num">${fmt(tot.taxable)}</td><td class="num">${fmt(tot.zeroRated)}</td>
    <td class="num">${fmt(tot.exempt)}</td><td class="num">${fmt(tot.vat)}</td>`;
  const slpFoot = `<td colspan="4" style="font-weight:700;">TOTALS</td>
    <td class="num">${fmt(tot.cap)}</td><td class="num">${fmt(tot.other)}</td>
    <td class="num">${fmt(tot.svc)}</td><td class="num">${fmt(tot.zr)}</td>
    <td class="num">${fmt(tot.ex)}</td><td class="num">${fmt(tot.vat)}</td>`;

  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Transactions</div><div class="stat-value">${rows.length}</div></div>
      ${isSLS
        ? `<div class="stat-card"><div class="stat-label">Taxable Sales</div><div class="stat-value small">₱ ${fmt(tot.taxable)}</div></div>
           <div class="stat-card"><div class="stat-label">Output VAT</div><div class="stat-value small">₱ ${fmt(tot.vat)}</div></div>`
        : `<div class="stat-card"><div class="stat-label">Capital Goods</div><div class="stat-value small">₱ ${fmt(tot.cap)}</div></div>
           <div class="stat-card"><div class="stat-label">Input VAT</div><div class="stat-value small">₱ ${fmt(tot.vat)}</div></div>`}
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${isSLS ? slsHead : slpHead}</tr></thead>
        <tbody>${rows.map(r => isSLS ? slsRow(r) : slpRow(r)).join('')}</tbody>
        <tfoot><tr>${isSLS ? slsFoot : slpFoot}</tr></tfoot>
      </table>
    </div>`;
}

// ── EXPORT EXCEL ──────────────────────────────────────────────
function tinDashed(t) {
  const d = (t || '').replace(/\D/g, '').padEnd(9, '0').substring(0, 9);
  return `${d.substring(0,3)}-${d.substring(3,6)}-${d.substring(6,9)}`;
}

function partyNameCols(r) {
  const isInd = !r.companyName && (r.lastName || r.firstName || r.middleName);
  if (isInd) {
    const full = [r.lastName, [r.firstName, r.middleName].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return ['', full];
  }
  return [r.companyName || r.name || '', ''];
}

function exportExcel(rows, type, periodLabel, setup, periodEnd) {
  if (!window.XLSX) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => exportExcel(rows, type, periodLabel, setup, periodEnd);
    document.head.appendChild(s); return;
  }
  const isSLS = type === 'sls';
  const ownerIsInd = setup.classification === 'Individual';
  const ownerName = ownerIsInd
    ? [setup.lastName, [setup.firstName, setup.middleName].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : (setup.companyName || setup.taxpayerName || '');
  const monthDate = periodEnd ? new Date(periodEnd) : null;

  const data = [
    [isSLS ? 'SALES TRANSACTION' : 'PURCHASE TRANSACTION'],
    ['RECONCILIATION OF LISTING FOR ENFORCEMENT'],
    [], [], [],
    [`TIN : ${tinDashed(setup.tin)}`],
    [`OWNER'S NAME: ${ownerName.toUpperCase()}`],
    [`OWNER'S TRADE NAME : ${(setup.companyName || setup.taxpayerName || '').toUpperCase()}`],
    [`OWNER'S ADDRESS: ${(setup.address || '').toUpperCase()}${setup.zipCode ? ' ' + setup.zipCode : ''}`],
    [],
  ];

  if (isSLS) {
    data.push(['TAXABLE','TAXPAYER','REGISTERED NAME','NAME OF CUSTOMER',"CUSTOMER'S ADDRESS",'AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF']);
    data.push(['MONTH','IDENTIFICATION','','(Last Name, First Name, Middle Name)','','GROSS SALES','EXEMPT SALES','ZERO RATED SALES','TAXABLE SALES','OUTPUT TAX','GROSS TAXABLE SALES']);
    data.push(['','NUMBER','','','','','','','','','']);
    data.push(['(1)','(2)','(3)','(4)','(5)','(6)','(7)','(8)','(9)','(10)','(11)']);

    rows.forEach(r => {
      const [regName, custName] = partyNameCols(r);
      const gross = r.exempt + r.zeroRated + r.taxable;
      const grossTaxable = r.taxable + r.outputVAT;
      data.push([
        monthDate, tinDashed(r.tin), regName.toUpperCase(), custName.toUpperCase(),
        [r.address1, r.address2].filter(Boolean).join(' ').toUpperCase(),
        gross, r.exempt, r.zeroRated, r.taxable, r.outputVAT, grossTaxable,
      ]);
    });
  } else {
    data.push(['TAXABLE','TAXPAYER','REGISTERED NAME','NAME OF SUPPLIER',"SUPPLIER'S ADDRESS",'AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF','AMOUNT OF']);
    data.push(['MONTH','IDENTIFICATION','','(Last Name, First Name, Middle Name)','','GROSS PURCHASE','EXEMPT PURCHASE','ZERO-RATED PURCHASE','TAXABLE PURCHASE','PURCHASE OF SERVICES','PURCHASE OF CAPITAL GOODS','PURCHASE OF GOODS OTHER THAN CAPITAL GOODS','INPUT TAX','GROSS TAXABLE PURCHASE']);
    data.push(['','NUMBER','','','','','','','','','','','','']);
    data.push(['(1)','(2)','(3)','(4)','(5)','(6)','(7)','(8)','(9)','(10)','(11)','(12)','(13)','(14)']);

    rows.forEach(r => {
      const [regName, suppName] = partyNameCols(r);
      const taxable = r.services + r.capGoods + r.otherGoods;
      const gross = r.exempt + r.zeroRated + taxable;
      const grossTaxable = taxable + r.inputVAT;
      data.push([
        monthDate, tinDashed(r.tin), regName.toUpperCase(), suppName.toUpperCase(),
        [r.address1, r.address2].filter(Boolean).join(' ').toUpperCase(),
        gross, r.exempt, r.zeroRated, taxable, r.services, r.capGoods, r.otherGoods, r.inputVAT, grossTaxable,
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSLS ? 'SLS' : 'SLP');
  XLSX.writeFile(wb, `${type.toUpperCase()}_${periodLabel.replace(/[\s()–\/]/g,'_')}.xlsx`);
}

// ── EXPORT DAT (BIR RELIEF/eSubmission format) ─────────────────
function tin9(t) {
  const digits = (t || '').replace(/\D/g, '');
  return (digits.substring(0, 9) || '').padEnd(9, '0').substring(0, 9) || '000000000';
}

function datDate(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${dt.getFullYear()}`;
}

function csvNum(n) {
  return (Number(n) || 0).toFixed(2);
}

function exportDAT(rows, type, setup, periodEnd) {
  const isSLS = type === 'sls';
  const isInd = setup.classification === 'Individual';

  const ourTin = tin9(setup.tin);
  const ln = isInd ? (setup.lastName || '').toUpperCase()  : '';
  const fn = isInd ? (setup.firstName || '').toUpperCase() : '';
  const mn = isInd ? (setup.middleName || '').toUpperCase(): '';
  const regName = (setup.companyName || setup.taxpayerName || '').toUpperCase();
  const addr1 = (setup.address || '').toUpperCase();
  const addr2 = (setup.zipCode || '').toUpperCase();
  const rdo = setup.rdoCode || '';
  const dateStr = datDate(periodEnd);

  const lines = [];

  if (isSLS) {
    const tot = rows.reduce((a, r) => ({
      exempt: a.exempt + r.exempt, zeroRated: a.zeroRated + r.zeroRated,
      taxable: a.taxable + r.taxable, vat: a.vat + r.outputVAT,
    }), { exempt: 0, zeroRated: 0, taxable: 0, vat: 0 });

    lines.push([
      'H', 'S', `"${ourTin}"`, '""', `"${ln}"`, `"${fn}"`, `"${mn}"`, `"${regName}"`, `"${addr1}"`, `"${addr2}"`,
      csvNum(tot.exempt), csvNum(tot.zeroRated), csvNum(tot.taxable), csvNum(tot.vat),
      rdo, dateStr, '12',
    ].join(','));

    for (const r of rows) {
      const buyerTin = tin9(r.tin);
      const buyerReg = (r.companyName || '').toUpperCase();
      const bln = (r.lastName || '').toUpperCase();
      const bfn = (r.firstName || '').toUpperCase();
      const bmn = (r.middleName || '').toUpperCase();
      const a1  = (r.address1 || '').toUpperCase();
      const a2  = (r.address2 || '').toUpperCase();
      lines.push([
        'D', 'S', `"${buyerTin}"`, `"${buyerReg}"`, `"${bln}"`, `"${bfn}"`, `"${bmn}"`, `"${a1}"`, `"${a2}"`,
        csvNum(r.exempt), csvNum(r.zeroRated), csvNum(r.taxable), csvNum(r.outputVAT),
        `"${ourTin}"`, datDate(r.date),
      ].join(','));
    }
  } else {
    const tot = rows.reduce((a, r) => ({
      exempt: a.exempt + r.exempt, zeroRated: a.zeroRated + r.zeroRated,
      capGoods: a.capGoods + r.capGoods, services: a.services + r.services,
      otherGoods: a.otherGoods + r.otherGoods, vat: a.vat + r.inputVAT,
    }), { exempt: 0, zeroRated: 0, capGoods: 0, services: 0, otherGoods: 0, vat: 0 });

    lines.push([
      'H', 'P', `"${ourTin}"`, '""', `"${ln}"`, `"${fn}"`, `"${mn}"`, `"${regName}"`, `"${addr1}"`, `"${addr2}"`,
      csvNum(tot.exempt), csvNum(tot.zeroRated), csvNum(tot.services), csvNum(tot.capGoods), csvNum(tot.otherGoods),
      csvNum(tot.vat), csvNum(tot.vat), csvNum(0),
      rdo, dateStr, '12',
    ].join(','));

    for (const r of rows) {
      const sellerTin = tin9(r.tin);
      const sellerReg = (r.companyName || '').toUpperCase();
      const sln = (r.lastName || '').toUpperCase();
      const sfn = (r.firstName || '').toUpperCase();
      const smn = (r.middleName || '').toUpperCase();
      const a1  = (r.address1 || '').toUpperCase();
      const a2  = (r.address2 || '').toUpperCase();
      lines.push([
        'D', 'P', `"${sellerTin}"`, `"${sellerReg}"`, `"${sln}"`, `"${sfn}"`, `"${smn}"`, `"${a1}"`, `"${a2}"`,
        csvNum(r.exempt), csvNum(r.zeroRated), csvNum(r.services), csvNum(r.capGoods), csvNum(r.otherGoods), csvNum(r.inputVAT),
        `"${ourTin}"`, datDate(r.date),
      ].join(','));
    }
  }

  const content = lines.join('\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/plain' });
  const periodTag = periodEnd ? `${String(periodEnd.getMonth()+1).padStart(2,'0')}${periodEnd.getFullYear()}` : '';
  const fname = `${ourTin}${isSLS ? 'S' : 'P'}${periodTag}.DAT`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fname });
  a.click(); URL.revokeObjectURL(a.href);
}
