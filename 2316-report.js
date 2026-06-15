/* ============================================================
   Tallo CPA – BIR Tax App
   2316-report.js – BIR Form 2316 Certificate of Compensation
                     Payment / Tax Withheld, per employee, tab
                     embedded inside alphalist.html (1604-C).
   ============================================================ */

let _form2316State = { biz: null, setup: null, employees: null, year: null };

async function init2316Tab(biz, setup) {
  _form2316State.biz = biz;
  _form2316State.setup = setup;

  const filterEl = document.querySelector('#tab-2316 .filter-bar');
  const now = new Date();
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  filterEl.innerHTML = `
    <label>Year</label>
    <select id="f2316-year">
      ${years.map(y => `<option value="${y}"${y === now.getFullYear() - 1 ? ' selected' : ''}>${y}</option>`).join('')}
    </select>
    <label>Employees</label>
    <select id="f2316-employee" multiple style="min-width:220px; height:60px;">
      <option value="__all__" selected>All employees</option>
    </select>
    <button class="btn btn-primary" id="f2316-gen">⚡ Generate</button>
    <button class="btn btn-outline" id="f2316-print" style="display:none;" onclick="window.print()">🖨 Print</button>
  `;

  try {
    const employees = await loadEmployeesBIR(biz);
    _form2316State.employees = employees;
    const sel = document.getElementById('f2316-employee');
    Object.entries(employees).forEach(([key, e]) => {
      const name = [e.lastName, e.firstName, e.middleName].filter(Boolean).join(', ') || e.name;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      const all = sel.querySelector('option[value="__all__"]');
      const others = [...sel.options].filter(o => o.value !== '__all__');
      if (all.selected) others.forEach(o => o.selected = false);
    });
  } catch (e) {
    console.warn('2316: could not load employees', e.message);
  }

  document.getElementById('f2316-gen').addEventListener('click', generate2316);
}

async function generate2316() {
  const { biz, setup, employees } = _form2316State;
  const outputEl = document.getElementById('form2316-output');
  const year = parseInt(document.getElementById('f2316-year').value, 10);
  const sel = document.getElementById('f2316-employee');
  const selected = [...sel.selectedOptions].map(o => o.value);
  const wantAll = selected.includes('__all__') || selected.length === 0;

  outputEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Computing annual compensation…</span></div>`;

  try {
    const byEmployee = await buildPayrollYear(biz, year);
    const empKeys = wantAll ? Object.keys(byEmployee) : selected.filter(k => byEmployee[k]);

    if (!empKeys.length) {
      outputEl.innerHTML = `<div class="alert alert-warn">⚠️ No payroll data found for ${year}.</div>`;
      return;
    }

    const certs = empKeys.map(key => {
      const emp = employees[key] || { name: key, taxStatus: 'NMWE' };
      const monthly = computeEmployee1601C(byEmployee[key].months, emp.taxStatus);
      return render2316Cert(emp, monthly, byEmployee[key].months, setup, year);
    });

    outputEl.innerHTML = certs.join('<div class="page-break" style="break-after:page;"></div>');
    document.getElementById('f2316-print').style.display = '';
  } catch (err) {
    outputEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

// ── RENDER A SINGLE 2316 CERTIFICATE ───────────────────────────
function render2316Cert(emp, monthly, months, setup, year) {
  const isMWE = emp.taxStatus === 'MWE';
  const name = [emp.lastName, emp.firstName, emp.middleName].filter(Boolean).join(', ') || emp.name;

  // Annual totals (sum of monthly computed lines)
  const sum = (k) => monthly.reduce((a, m) => a + (m[k] || 0), 0);
  const grossComp   = sum('line14');
  const nonTaxable  = sum('line21');
  const taxableComp = sum('line22');
  const taxWithheld = sum('line25');

  // Supplementary / breakdown of gross compensation by category
  const catTotal = (cat) => months.reduce((a, b) => a + (b[cat] || 0), 0);
  const basic       = catTotal(PH_CAT.BASIC);
  const ot          = catTotal(PH_CAT.OT);
  const holiday     = catTotal(PH_CAT.HOLIDAY);
  const nightDiff   = catTotal(PH_CAT.NIGHT_DIFF);
  const hazard      = catTotal(PH_CAT.HAZARD);
  const thirteenth  = catTotal(PH_CAT.THIRTEENTH);
  const deMinimis   = catTotal(PH_CAT.DE_MINIMIS);
  const otherTax    = catTotal(PH_CAT.OTHER_TAXABLE);
  const commission  = catTotal(PH_CAT.COMMISSION);
  const profitShare = catTotal(PH_CAT.PROFIT_SHARE);
  const directorFee = catTotal(PH_CAT.DIRECTOR_FEE);
  const separation  = catTotal(PH_CAT.SEPARATION);
  const sssEe       = catTotal(PH_CAT.SSS_EE);
  const phicEe      = catTotal(PH_CAT.PHIC_EE);
  const hdmfEe      = catTotal(PH_CAT.HDMF_EE);

  // Annual tax due (per TRAIN graduated table on taxable income)
  const taxDue = computeAnnualTax(taxableComp);

  const isInd = setup.classification === 'Individual';
  const employerName = isInd
    ? [setup.lastName, setup.firstName, setup.middleName].filter(Boolean).join(', ')
    : (setup.companyName || setup.taxpayerName || '');

  return `
    <div class="form-title">
      <h2>BIR Form 2316 — Certificate of Compensation Payment / Tax Withheld</h2>
      <div class="sub">For the Year ${year}</div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Part I – Employee Information</div>
      <div class="return-line"><div class="return-line-label">Employee Name</div><div class="return-line-amt" style="font-size:11px;">${escHtml(name)}</div></div>
      <div class="return-line"><div class="return-line-label">TIN</div><div class="return-line-amt">${escHtml(tinDashed1601(emp.tin))}</div></div>
      <div class="return-line"><div class="return-line-label">Address</div><div class="return-line-amt" style="font-size:11px;">${escHtml(emp.address || '—')} ${escHtml(emp.zipCode || '')}</div></div>
      <div class="return-line"><div class="return-line-label">Tax Status</div><div class="return-line-amt">${isMWE ? 'MWE — Minimum Wage Earner' : 'NMWE — Non-Minimum Wage Earner'}</div></div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Part II – Employer Information (Present Employer)</div>
      <div class="return-line"><div class="return-line-label">Employer Name</div><div class="return-line-amt" style="font-size:11px;">${escHtml(employerName)}</div></div>
      <div class="return-line"><div class="return-line-label">TIN</div><div class="return-line-amt">${escHtml(tinDashed1601(setup.tin))}</div></div>
      <div class="return-line"><div class="return-line-label">RDO Code</div><div class="return-line-amt">${escHtml(setup.rdoCode || '—')}</div></div>
      <div class="return-line"><div class="return-line-label">Registered Address</div><div class="return-line-amt" style="font-size:11px;">${escHtml(setup.address || '—')}</div></div>
    </div>

    <div class="return-section">
      <div class="return-section-header">Part IV-A – Summary</div>
      ${returnLine(19, 'Gross Compensation Income', grossComp, true)}
      ${returnLine(20, 'Less: Non-Taxable / Exempt Compensation Income', nonTaxable)}
      ${returnLine(21, 'Taxable Compensation Income', taxableComp, true)}
      ${returnLine(24, 'Tax Due', taxDue, true)}
      ${returnLine(25, 'Less: Tax Withheld for the Year', taxWithheld)}
      ${returnLine(27, 'Total Amount of Taxes Withheld', taxWithheld, true, 'highlight')}
    </div>

    <div class="return-section">
      <div class="return-section-header">Part IV-B – Details of Compensation Income and Tax Withheld</div>
      ${returnLine('29', 'Basic Salary', basic)}
      ${returnLine('29a', 'Overtime Pay', ot)}
      ${returnLine('29b', 'Holiday Pay', holiday)}
      ${returnLine('29c', 'Night Shift Differential', nightDiff)}
      ${returnLine('29d', 'Hazard Pay', hazard)}
      ${returnLine('30', 'Commission', commission)}
      ${returnLine('31', 'Profit Sharing', profitShare)}
      ${returnLine('32', "Fees Including Director's Fees", directorFee)}
      ${returnLine('33', 'Other Taxable Compensation', otherTax)}
      ${returnLine('34', 'Separation Pay / Retirement Benefits', separation)}
      ${returnLine('45', '13th Month Pay and Other Benefits (Total)', thirteenth)}
      ${returnLine('46', 'De Minimis Benefits', deMinimis)}
      ${returnLine('47', 'SSS, GSIS, PHIC, HDMF Contributions &amp; Union Dues (Employee share)', sssEe + phicEe + hdmfEe)}
    </div>`;
}
