/* ============================================================
   Tallo CPA – BIR Tax App
   sls-report.js  –  Summary List of Sales and Purchases
                     with DAT download and Excel export
   ============================================================ */

let _slRows = [];

function initSLReport(type) {
  const biz   = localStorage.getItem('tallocpa_last_business') || '';
  const setup = biz ? getSetup(biz) : null;
  const isSLS = type === 'sls';

  const filterEl = document.getElementById('filter-area');
  const outputEl = document.getElementById('report-output');

  if (!biz || !setup) {
    outputEl.innerHTML = `<div class="alert alert-warn">⚠️ No business selected. Open <strong>Tallo CPA Setup</strong> first.</div>`;
    return;
  }

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
  const vm = setup.vatMapping || {};

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

    document.getElementById('sl-excel').onclick = () => exportExcel(rows, type, periodLabel, setup);
    document.getElementById('sl-dat').onclick   = () => exportDAT(rows, type, setup);

  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

// ── BUILD ROWS ────────────────────────────────────────────────
async function buildSLSRows(biz, start, end, vm) {
  const items   = await fetchAllBatch('/api4/sales-invoice-batch', biz);
  const custMap = getCustomers(biz);
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
      name, tin: cd.tin || '', address: [cd.address1, cd.address2].filter(Boolean).join(', '),
      taxable, zeroRated, exempt, outputVAT,
      total: taxable + zeroRated + exempt,
    });
  }
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function buildSLPRows(biz, start, end, vm) {
  const items   = await fetchAllBatch('/api4/purchase-invoice-batch', biz);
  const suppMap = getSuppliers(biz);
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
      name, tin: sd.tin || '', address: [sd.address1, sd.address2].filter(Boolean).join(', '),
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
function exportExcel(rows, type, periodLabel, setup) {
  if (!window.XLSX) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => exportExcel(rows, type, periodLabel, setup);
    document.head.appendChild(s); return;
  }
  const isSLS = type === 'sls';
  const title = isSLS ? 'Summary List of Sales' : 'Summary List of Purchases';
  const data  = [
    [title],
    [`Period: ${periodLabel}`],
    [`Taxpayer: ${setup.taxpayerName||''}  |  TIN: ${setup.tin||''}  |  RDO: ${setup.rdoCode||''}`],
    [],
  ];
  if (isSLS) {
    data.push(['Date','Invoice No.','Buyer Name','TIN','Address','Taxable','Zero-Rated','Exempt','Output VAT']);
    rows.forEach(r => data.push([r.date, r.reference, r.name, r.tin, r.address, r.taxable, r.zeroRated, r.exempt, r.outputVAT]));
  } else {
    data.push(['Date','Invoice No.','Seller Name','TIN','Address','Capital Goods','Other Goods','Services','Zero-Rated','Exempt','Input VAT']);
    rows.forEach(r => data.push([r.date, r.reference, r.name, r.tin, r.address, r.capGoods, r.otherGoods, r.services, r.zeroRated, r.exempt, r.inputVAT]));
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSLS ? 'SLS' : 'SLP');
  XLSX.writeFile(wb, `${type.toUpperCase()}_${periodLabel.replace(/[\s()–\/]/g,'_')}.xlsx`);
}

// ── EXPORT DAT ────────────────────────────────────────────────
function exportDAT(rows, type, setup) {
  const isSLS = type === 'sls';
  const tin   = (setup.tin || '').replace(/-/g,'').padEnd(12).substring(0,12);
  const tname = (setup.taxpayerName || '').toUpperCase().substring(0,50);
  const lines = rows.map(r => {
    const pTIN  = (r.tin || '').replace(/-/g,'').padEnd(12).substring(0,12);
    const pName = (r.name || '').toUpperCase().substring(0,50);
    const dt    = (r.date||'').substring(0,10).replace(/-/g,'/');
    const ref   = (r.reference||'').substring(0,30);
    if (isSLS) return [tin, tname, pTIN, pName, dt, ref,
      r.taxable.toFixed(2), r.zeroRated.toFixed(2), r.exempt.toFixed(2), r.outputVAT.toFixed(2)].join('|');
    return [tin, tname, pTIN, pName, dt, ref,
      r.capGoods.toFixed(2), r.otherGoods.toFixed(2), r.services.toFixed(2),
      r.zeroRated.toFixed(2), r.exempt.toFixed(2), r.inputVAT.toFixed(2)].join('|');
  });
  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${type.toUpperCase()}.dat` });
  a.click(); URL.revokeObjectURL(a.href);
}
