/* ============================================================
   Tallo CPA – BIR Tax App
   1601c-report.js – Monthly Remittance Return of Income Taxes
                      Withheld on Compensation (BIR Form 1601-C)
   ============================================================ */

async function init1601CReport() {
  const filterEl = document.getElementById('filter-area');
  const outputEl = document.getElementById('report-output');

  let biz;
  try {
    biz = await getReportBusiness(document.getElementById('biz-selector-wrap'));
    App.currentBusiness = biz;
  } catch (e) {
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

  filterEl.innerHTML = periodFilterHTML('monthly', 'c1601');
  filterEl.insertAdjacentHTML('beforeend', `
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">
      Business: <strong>${escHtml(biz)}</strong> &nbsp;|&nbsp;
      TIN: <strong>${escHtml(tinDashed1601(setup.tin))}</strong>
    </div>`);

  document.getElementById('c1601-gen').addEventListener('click', () => generate1601C(biz, setup, outputEl));
}


async function generate1601C(biz, setup, outputEl) {
  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Fetching payroll data…</span></div>`;

  const month = parseInt(document.getElementById('c1601-month').value, 10);
  const year  = parseInt(document.getElementById('c1601-year').value, 10);

  try {
    const [byEmployee, employees] = await Promise.all([
      buildPayrollYear(biz, year),
      loadEmployeesBIR(biz),
    ]);

    const rows = [];
    let totals = { line14:0, line17:0, line18:0, line19:0, line20:0, line21:0, line22:0, line23:0, line24:0, line25:0 };

    for (const [empKey, data] of Object.entries(byEmployee)) {
      const emp = employees[empKey] || { name: empKey, taxStatus: 'NMWE' };
      const computed = computeEmployee1601C(data.months, emp.taxStatus);
      const m = computed[month];
      if (!m.line14) continue; // skip employees with no pay this month

      const name = [emp.lastName, emp.firstName, emp.middleName].filter(Boolean).join(', ') || emp.name;
      rows.push({ empKey, name, tin: emp.tin, taxStatus: emp.taxStatus, ...m });

      for (const k of Object.keys(totals)) totals[k] += m[k] || 0;
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));

    const period = { month, year, label: `${monthName(month)} ${year}` };
    render1601C(outputEl, rows, totals, setup, period);

    ['c1601-print','c1601-pdf'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = '';
    });
  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function render1601C(el, rows, totals, setup, period) {
  const isInd = setup.classification === 'Individual';
  const agentName = isInd
    ? [setup.lastName, setup.firstName, setup.middleName].filter(Boolean).join(', ')
    : (setup.companyName || setup.taxpayerName || '');

  const taxDue = totals.line25; // Line 25 total per Part II is the basis carried to Part III
  const totalRemittance = taxDue;

  const detailRows = rows.map(r => `
    <tr>
      <td>${escHtml(r.name)}</td>
      <td style="font-family:monospace;">${escHtml(tinDashed1601(r.tin))}</td>
      <td>${escHtml(r.taxStatus)}</td>
      <td class="num">${fmt(r.line14)}</td>
      <td class="num">${fmt(r.line21)}</td>
      <td class="num">${fmt(r.line22)}</td>
      <td class="num">${fmt(r.line23)}</td>
      <td class="num">${fmt(r.line24)}</td>
      <td class="num">${fmt(r.line25)}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="form-title">
      <h2>BIR Form 1601-C — Monthly Remittance Return of Income Taxes Withheld on Compensation</h2>
      <div class="sub">For the Month of: ${escHtml(period.label)}</div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Part I – Background Information</div>
      <div class="return-line"><div class="return-line-num">6</div><div class="return-line-label">Taxpayer Identification Number (TIN)</div><div class="return-line-amt">${escHtml(tinDashed1601(setup.tin))}</div></div>
      <div class="return-line"><div class="return-line-num">7</div><div class="return-line-label">RDO Code</div><div class="return-line-amt">${escHtml(setup.rdoCode || '—')}</div></div>
      <div class="return-line"><div class="return-line-num">8</div><div class="return-line-label">Withholding Agent's Name</div><div class="return-line-amt" style="font-size:11px;">${escHtml(agentName)}</div></div>
      <div class="return-line"><div class="return-line-num">9</div><div class="return-line-label">Registered Address</div><div class="return-line-amt" style="font-size:11px;">${escHtml(setup.address || '—')}</div></div>
      <div class="return-line"><div class="return-line-num">9A</div><div class="return-line-label">ZIP Code</div><div class="return-line-amt">${escHtml(setup.zipCode || '—')}</div></div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Part II – Computation of Tax</div>
      ${returnLine(14, 'Total Amount of Compensation', totals.line14)}
      ${returnLine(17, 'Non-Taxable / Exempt Compensation (incl. 13th Month Pay &amp; De Minimis within limits)', totals.line17 + totals.line18 + totals.line20)}
      ${returnLine(19, 'SSS, GSIS, PHIC, HDMF &amp; Union Dues (Employee share)', totals.line19)}
      ${returnLine(21, 'Total Non-Taxable Compensation', totals.line21, true)}
      ${returnLine(22, 'Total Taxable Compensation (Line 14 less Line 21)', totals.line22, true)}
      ${returnLine(23, 'Less: Compensation of Employees Whose Tax Due is Zero (per Sched. I)', totals.line23)}
      ${returnLine(24, 'Net Taxable Compensation Subject to Withholding (Line 22 less Line 23)', totals.line24, true)}
      ${returnLine(25, 'Tax Required to be Withheld', totals.line25, true, 'highlight')}
      ${returnLine(26, 'Less: Adjustments for Excess/Deficiency Withholding from Previous Months', 0)}
      ${returnLine(27, 'Net Tax Required to be Withheld', totals.line25, true)}
      ${returnLine(28, 'Less: Tax Remitted in Return Previously Filed, if Amended', 0)}
      ${returnLine(29, 'TOTAL AMOUNT OF TAX WITHHELD AND REMITTED', totalRemittance, true, 'highlight payable')}
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Employees</div><div class="stat-value">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Compensation</div><div class="stat-value small">₱ ${fmt(totals.line14)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Tax Withheld</div><div class="stat-value small">₱ ${fmt(totals.line25)}</div></div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Schedule I — Per-Employee Computation for ${escHtml(period.label)}</div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Employee</th><th>TIN</th><th>Status</th>
            <th class="num">Gross Comp. (14)</th><th class="num">Non-Taxable (21)</th>
            <th class="num">Taxable (22)</th><th class="num">Excl. – Line 23</th>
            <th class="num">Net Taxable (24)</th><th class="num">Tax Withheld (25)</th>
          </tr></thead>
          <tbody>${detailRows || `<tr><td colspan="9" style="text-align:center;color:#9ca3af;">No payroll records for this month</td></tr>`}</tbody>
          <tfoot><tr>
            <td colspan="3" style="font-weight:700;">TOTALS</td>
            <td class="num">${fmt(totals.line14)}</td><td class="num">${fmt(totals.line21)}</td>
            <td class="num">${fmt(totals.line22)}</td><td class="num">${fmt(totals.line23)}</td>
            <td class="num">${fmt(totals.line24)}</td><td class="num">${fmt(totals.line25)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
}
