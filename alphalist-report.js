/* ============================================================
   Tallo CPA – BIR Tax App
   alphalist-report.js – BIR Form 1604-C Alphalist of Employees
                          Schedule 1 (NMWE) and Schedule 2 (MWE)
   ============================================================ */

let _alphaState = { biz: null, setup: null };

function initAlphalistTab(biz, setup) {
  _alphaState.biz = biz;
  _alphaState.setup = setup;

  const filterEl = document.querySelector('#tab-report .filter-bar');
  const now = new Date();
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  filterEl.innerHTML = `
    <label>Year</label>
    <select id="alpha-year">
      ${years.map(y => `<option value="${y}"${y === now.getFullYear() - 1 ? ' selected' : ''}>${y}</option>`).join('')}
    </select>
    <button class="btn btn-primary" id="alpha-gen">⚡ Generate</button>
    <button class="btn btn-outline" id="alpha-print" style="display:none;" onclick="window.print()">🖨 Print</button>
  `;

  document.getElementById('alpha-gen').addEventListener('click', generateAlphalist);
}

async function generateAlphalist() {
  const { biz, setup } = _alphaState;
  const outputEl = document.getElementById('report-output');
  const year = parseInt(document.getElementById('alpha-year').value, 10);

  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Computing annual compensation for ${year}…</span></div>`;

  try {
    const [byEmployee, employees] = await Promise.all([
      buildPayrollYear(biz, year),
      loadEmployeesBIR(biz),
    ]);

    const nmwe = [], mwe = [];

    for (const [empKey, data] of Object.entries(byEmployee)) {
      const emp = employees[empKey] || { name: empKey, taxStatus: 'NMWE' };
      const monthly = computeEmployee1601C(data.months, emp.taxStatus);
      const sum = (k) => monthly.reduce((a, m) => a + (m[k] || 0), 0);
      const catTotal = (cat) => data.months.reduce((a, b) => a + (b[cat] || 0), 0);

      const grossComp   = sum('line14');
      if (!grossComp) continue;

      const nonTaxable  = sum('line21');
      const taxableComp = sum('line22');
      const taxWithheld = sum('line25');
      const taxDue      = computeAnnualTax(taxableComp);

      const row = {
        empKey,
        tin: emp.tin,
        lastName: emp.lastName, firstName: emp.firstName, middleName: emp.middleName,
        name: [emp.lastName, emp.firstName, emp.middleName].filter(Boolean).join(', ') || emp.name,
        basic: catTotal(PH_CAT.BASIC),
        ot: catTotal(PH_CAT.OT),
        holiday: catTotal(PH_CAT.HOLIDAY),
        nightDiff: catTotal(PH_CAT.NIGHT_DIFF),
        hazard: catTotal(PH_CAT.HAZARD),
        thirteenth: catTotal(PH_CAT.THIRTEENTH),
        deMinimis: catTotal(PH_CAT.DE_MINIMIS),
        otherTax: catTotal(PH_CAT.OTHER_TAXABLE),
        commission: catTotal(PH_CAT.COMMISSION),
        profitShare: catTotal(PH_CAT.PROFIT_SHARE),
        directorFee: catTotal(PH_CAT.DIRECTOR_FEE),
        separation: catTotal(PH_CAT.SEPARATION),
        sssEe: catTotal(PH_CAT.SSS_EE), phicEe: catTotal(PH_CAT.PHIC_EE), hdmfEe: catTotal(PH_CAT.HDMF_EE),
        grossComp, nonTaxable, taxableComp, taxDue, taxWithheld,
      };

      if (emp.taxStatus === 'MWE') mwe.push(row); else nmwe.push(row);
    }

    nmwe.sort((a, b) => a.name.localeCompare(b.name));
    mwe.sort((a, b) => a.name.localeCompare(b.name));

    renderAlphalist(outputEl, nmwe, mwe, setup, year);
    document.getElementById('alpha-print').style.display = '';
  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function sumRows(rows, key) {
  return rows.reduce((a, r) => a + (r[key] || 0), 0);
}

function renderAlphalist(el, nmwe, mwe, setup, year) {
  const isInd = setup.classification === 'Individual';
  const employerName = isInd
    ? [setup.lastName, setup.firstName, setup.middleName].filter(Boolean).join(', ')
    : (setup.companyName || setup.taxpayerName || '');

  el.innerHTML = `
    <div class="form-title">
      <h2>BIR Form 1604-C — Alphalist of Employees</h2>
      <div class="sub">For the Year ${year} &nbsp;|&nbsp; Withholding Agent: ${escHtml(employerName)} &nbsp;|&nbsp; TIN: ${escHtml(tinDashed1601(setup.tin))}</div>
    </div>

    ${renderScheduleTable('Schedule 1 — Alphalist of Employees Other Than MWEs (NMWE), with or without Tax Due', nmwe, false)}
    ${renderScheduleTable('Schedule 2 — Alphalist of Minimum Wage Earners (MWE)', mwe, true)}
  `;
}

function renderScheduleTable(title, rows, isMWESchedule) {
  const baseCols = `
    <th>TIN</th><th>Last Name</th><th>First Name</th><th>Middle Name</th>
    <th class="num">Basic Salary</th>`;
  const mweCols = isMWESchedule ? `
    <th class="num">Overtime</th><th class="num">Holiday Pay</th>
    <th class="num">Night Diff.</th><th class="num">Hazard Pay</th>` : '';
  const restCols = `
    <th class="num">13th Month &amp; Other Benefits</th>
    <th class="num">De Minimis</th>
    <th class="num">Commission</th>
    <th class="num">Profit Share</th>
    <th class="num">Director's Fees</th>
    <th class="num">Other Taxable</th>
    <th class="num">Separation/Retirement</th>
    <th class="num">SSS/PHIC/HDMF (EE)</th>
    <th class="num">Gross Compensation</th>
    <th class="num">Non-Taxable Comp.</th>
    <th class="num">Taxable Comp.</th>
    <th class="num">Tax Due</th>
    <th class="num">Tax Withheld</th>`;

  const bodyRows = rows.map(r => `
    <tr>
      <td style="font-family:monospace;">${escHtml(tinDashed1601(r.tin))}</td>
      <td>${escHtml(r.lastName)}</td><td>${escHtml(r.firstName)}</td><td>${escHtml(r.middleName)}</td>
      <td class="num">${fmt(r.basic)}</td>
      ${isMWESchedule ? `<td class="num">${fmt(r.ot)}</td><td class="num">${fmt(r.holiday)}</td><td class="num">${fmt(r.nightDiff)}</td><td class="num">${fmt(r.hazard)}</td>` : ''}
      <td class="num">${fmt(r.thirteenth)}</td>
      <td class="num">${fmt(r.deMinimis)}</td>
      <td class="num">${fmt(r.commission)}</td>
      <td class="num">${fmt(r.profitShare)}</td>
      <td class="num">${fmt(r.directorFee)}</td>
      <td class="num">${fmt(r.otherTax)}</td>
      <td class="num">${fmt(r.separation)}</td>
      <td class="num">${fmt(r.sssEe + r.phicEe + r.hdmfEe)}</td>
      <td class="num">${fmt(r.grossComp)}</td>
      <td class="num">${fmt(r.nonTaxable)}</td>
      <td class="num">${fmt(r.taxableComp)}</td>
      <td class="num">${fmt(r.taxDue)}</td>
      <td class="num">${fmt(r.taxWithheld)}</td>
    </tr>`).join('');

  const totalsCols = `
    <td class="num">${fmt(sumRows(rows,'basic'))}</td>
    ${isMWESchedule ? `<td class="num">${fmt(sumRows(rows,'ot'))}</td><td class="num">${fmt(sumRows(rows,'holiday'))}</td><td class="num">${fmt(sumRows(rows,'nightDiff'))}</td><td class="num">${fmt(sumRows(rows,'hazard'))}</td>` : ''}
    <td class="num">${fmt(sumRows(rows,'thirteenth'))}</td>
    <td class="num">${fmt(sumRows(rows,'deMinimis'))}</td>
    <td class="num">${fmt(sumRows(rows,'commission'))}</td>
    <td class="num">${fmt(sumRows(rows,'profitShare'))}</td>
    <td class="num">${fmt(sumRows(rows,'directorFee'))}</td>
    <td class="num">${fmt(sumRows(rows,'otherTax'))}</td>
    <td class="num">${fmt(sumRows(rows,'separation'))}</td>
    <td class="num">${fmt(sumRows(rows,'sssEe')+sumRows(rows,'phicEe')+sumRows(rows,'hdmfEe'))}</td>
    <td class="num">${fmt(sumRows(rows,'grossComp'))}</td>
    <td class="num">${fmt(sumRows(rows,'nonTaxable'))}</td>
    <td class="num">${fmt(sumRows(rows,'taxableComp'))}</td>
    <td class="num">${fmt(sumRows(rows,'taxDue'))}</td>
    <td class="num">${fmt(sumRows(rows,'taxWithheld'))}</td>`;

  const colCount = 4 + 1 + (isMWESchedule ? 4 : 0) + 12;

  return `
    <div class="return-section">
      <div class="return-section-header">${title}</div>
      <div class="data-table-wrap">
        <table class="data-table" style="font-size:10px;">
          <thead><tr>${baseCols}${mweCols}${restCols}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${colCount}" style="text-align:center;color:#9ca3af;">No employees in this category for the year</td></tr>`}</tbody>
          <tfoot><tr><td colspan="4" style="font-weight:700;">TOTALS (${rows.length} employee${rows.length===1?'':'s'})</td>${totalsCols}</tr></tfoot>
        </table>
      </div>
    </div>`;
}
