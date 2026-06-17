/* ============================================================
   Tallo CPA – BIR Tax App
   sss-report.js – SSS / PhilHealth / Pag-IBIG Remittance report.
                   Monthly per-employee summary of government
                   contribution shares (employee + employer),
                   for ALL employees regardless of Tax Status —
                   this is a remittance report, not an income
                   tax report, so MWE/NMWE status is irrelevant.
   ============================================================ */

async function initSSSReport() {
  const filterEl = document.getElementById('filter-area');
  const outputEl = document.getElementById('report-output');

  let biz;
  try {
    biz = await getReportBusiness(document.getElementById('biz-selector-wrap'));
    App.currentBusiness = biz;
  } catch (e) {
    outputEl.innerHTML = `<div class="alert alert-warn">⚠️ Could not connect to Manager: ${escHtml(e.message)}</div>`;
    return null;
  }

  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading business setup…</span></div>`;
  const setup = await loadSetup(biz);
  if (!setup) {
    outputEl.innerHTML = `<div class="alert alert-warn">⚠️ Business info not configured. Fill in the <strong>Business</strong> tab in the Tallo CPA extension first.</div>`;
    return null;
  }
  outputEl.innerHTML = '';

  filterEl.innerHTML = periodFilterHTML('monthly', 'sss');
  filterEl.insertAdjacentHTML('beforeend', `
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">
      Business: <strong>${escHtml(biz)}</strong>
    </div>`);

  document.getElementById('sss-gen').addEventListener('click', () => generateSSS(biz, setup, outputEl));
  return biz;
}

async function generateSSS(biz, setup, outputEl) {
  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Fetching payroll data…</span></div>`;

  const month = parseInt(document.getElementById('sss-month').value, 10);
  const year  = parseInt(document.getElementById('sss-year').value, 10);

  try {
    const [byEmployee, employees] = await Promise.all([
      buildPayrollYear(biz, year),
      loadEmployeesBIR(biz),
    ]);

    const rows = [];
    let totals = { sssEe:0, sssEr:0, phicEe:0, phicEr:0, hdmfEe:0, hdmfEr:0 };

    for (const [empKey, data] of Object.entries(byEmployee)) {
      const emp = employees[empKey];
      const b = data.months[month] || {};

      const sssEe  = b[PH_CAT.SSS_EE]  || 0;
      const sssEr  = b[PH_CAT.SSS_ER]  || 0;
      const phicEe = b[PH_CAT.PHIC_EE] || 0;
      const phicEr = b[PH_CAT.PHIC_ER] || 0;
      const hdmfEe = b[PH_CAT.HDMF_EE] || 0;
      const hdmfEr = b[PH_CAT.HDMF_ER] || 0;

      if (!sssEe && !sssEr && !phicEe && !phicEr && !hdmfEe && !hdmfEr) continue; // no contributions this month

      const name = emp
        ? ([emp.lastName, emp.firstName, emp.middleName].filter(Boolean).join(', ') || emp.name)
        : empKey;

      rows.push({ empKey, name, sssEe, sssEr, phicEe, phicEr, hdmfEe, hdmfEr });

      totals.sssEe += sssEe; totals.sssEr += sssEr;
      totals.phicEe += phicEe; totals.phicEr += phicEr;
      totals.hdmfEe += hdmfEe; totals.hdmfEr += hdmfEr;
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));

    const period = { month, year, label: `${monthName(month)} ${year}` };
    renderSSS(outputEl, rows, totals, setup, period);

    ['sss-print','sss-pdf'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = '';
    });
  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function renderSSS(el, rows, totals, setup, period) {
  const detailRows = rows.map(r => `
    <tr>
      <td>${escHtml(r.name)}</td>
      <td class="num">${fmt(r.sssEe)}</td>
      <td class="num">${fmt(r.sssEr)}</td>
      <td class="num">${fmt(r.phicEe)}</td>
      <td class="num">${fmt(r.phicEr)}</td>
      <td class="num">${fmt(r.hdmfEe)}</td>
      <td class="num">${fmt(r.hdmfEr)}</td>
    </tr>`).join('');

  const grandTotal = totals.sssEe + totals.sssEr + totals.phicEe + totals.phicEr + totals.hdmfEe + totals.hdmfEr;

  el.innerHTML = `
    <div class="form-title">
      <h2>SSS / PhilHealth / Pag-IBIG Remittance</h2>
      <div class="sub">For the Month of: ${escHtml(period.label)}</div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Employees</div><div class="stat-value">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total SSS</div><div class="stat-value small">₱ ${fmt(totals.sssEe + totals.sssEr)}</div></div>
      <div class="stat-card"><div class="stat-label">Total PhilHealth</div><div class="stat-value small">₱ ${fmt(totals.phicEe + totals.phicEr)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Pag-IBIG</div><div class="stat-value small">₱ ${fmt(totals.hdmfEe + totals.hdmfEr)}</div></div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Per-Employee Remittance Schedule — ${escHtml(period.label)}</div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Employee</th>
            <th class="num">SSS – EE</th><th class="num">SSS – ER</th>
            <th class="num">PhilHealth – EE</th><th class="num">PhilHealth – ER</th>
            <th class="num">Pag-IBIG – EE</th><th class="num">Pag-IBIG – ER</th>
          </tr></thead>
          <tbody>${detailRows || `<tr><td colspan="7" style="text-align:center;color:#9ca3af;">No contributions found for this month</td></tr>`}</tbody>
          <tfoot><tr>
            <td style="font-weight:700;">TOTALS</td>
            <td class="num">${fmt(totals.sssEe)}</td><td class="num">${fmt(totals.sssEr)}</td>
            <td class="num">${fmt(totals.phicEe)}</td><td class="num">${fmt(totals.phicEr)}</td>
            <td class="num">${fmt(totals.hdmfEe)}</td><td class="num">${fmt(totals.hdmfEr)}</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="text-align:right;margin-top:8px;font-weight:700;">Grand Total Remittance: ₱ ${fmt(grandTotal)}</div>
    </div>`;
}
