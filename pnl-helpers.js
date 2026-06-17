/* ============================================================
   Tallo CPA – BIR Tax App
   pnl-helpers.js – Chart-of-Accounts cache + transaction
                     aggregator used by Income Tax (1701/1702)
                     and Tax Reconciliation reports.

   Manager.io has no API endpoint that returns computed P&L /
   trial-balance figures — only report *definitions*. The
   `profit-and-loss-statement-account-batch` and
   `balance-sheet-account-batch` endpoints, however, return the
   real Chart of Accounts (name + group). Combined with the raw
   transaction batches (journal entries, invoices, receipts,
   payments) which carry a denormalized `account` GUID and
   debit/credit amounts, we can reconstruct P&L totals ourselves.
   ============================================================ */

// Standard Manager.io system group GUIDs (same across all businesses).
const PNL_GROUP = {
  SALES: '95713fac-30d3-42e4-b536-dd7bc4f7a80e',   // Sales / Other Income
  COGS:  '11eafe62-925c-4b6b-8321-1b5485a963cc',   // Cost of Sales
  OPEX:  'fd003045-876e-439e-b923-1904453f5c30',   // Operating Expenses
};

function pnlBucketForGroup(groupGuid) {
  if (groupGuid === PNL_GROUP.SALES) return 'income';
  if (groupGuid === PNL_GROUP.COGS) return 'cogs';
  if (groupGuid === PNL_GROUP.OPEX) return 'opex';
  return 'other';
}

// ── CHART OF ACCOUNTS CACHE ──────────────────────────────────
let _coaCache = {}; // { [biz]: { [accountGuid]: {...} } }

async function loadChartOfAccounts(biz, force = false) {
  if (!force && _coaCache[biz]) return _coaCache[biz];

  const [pnlAccounts, bsAccounts] = await Promise.all([
    fetchAllBatch('/api4/profit-and-loss-statement-account-batch', biz),
    fetchAllBatch('/api4/balance-sheet-account-batch', biz),
  ]);

  const byKey = {};
  for (const it of pnlAccounts) {
    const a = it.item || it.value || it;
    byKey[a.key || it.key] = {
      key: a.key || it.key,
      name: a.name,
      group: a.group,
      bucket: pnlBucketForGroup(a.group),
      isProfitAndLossAccount: true,
    };
  }
  for (const it of bsAccounts) {
    const a = it.item || it.value || it;
    byKey[a.key || it.key] = {
      key: a.key || it.key,
      name: a.name,
      group: a.group,
      bucket: 'balanceSheet',
      isProfitAndLossAccount: false,
    };
  }

  _coaCache[biz] = byKey;
  return byKey;
}

function findAccountByName(coa, nameSubstr) {
  const needle = nameSubstr.toLowerCase();
  return Object.values(coa).find(a => (a.name || '').toLowerCase().includes(needle)) || null;
}

// Tax-code rate cache, keyed by Manager tax-code GUID. Needed to back
// VAT out of invoice/receipt/payment line amounts (which only carry
// qty + unitPrice + taxCode, not a precomputed net amount) — see
// `lineAmounts()` in shared.js, the same helper the SLS/SLP/EWT
// reports already use.
let _taxRateCache = {};
async function loadTaxCodeRates(biz) {
  if (_taxRateCache[biz]) return _taxRateCache[biz];
  const taxCodes = await fetchManagerTaxCodes(biz);
  const rateByKey = {};
  for (const tc of taxCodes) rateByKey[tc.key] = tc.rate;
  _taxRateCache[biz] = rateByKey;
  return rateByKey;
}

function pnlLineTaxCodeKey(line) {
  const tc = line?.taxCode ?? line?.TaxCode ?? '';
  return (tc && typeof tc === 'object') ? (tc.key || tc.Key || '') : (tc || '');
}

// Journal-entry lines carry real credit/debit fields; invoice/receipt/
// payment lines only carry qty + unitPrice (+ optional discount/tax),
// so their GL amount has to be computed via lineAmounts(). Returns a
// signed contribution suitable for direct summation into income (CR
// normal balance) or cogs/opex (DR normal balance) buckets.
function pnlLineAmount(item, line, rateByKey, bucket) {
  const hasCredit = line.credit !== undefined || line.Credit !== undefined;
  const hasDebit  = line.debit  !== undefined || line.Debit  !== undefined;
  if (hasCredit || hasDebit) {
    const credit = Number(line.credit ?? line.Credit ?? 0);
    const debit  = Number(line.debit  ?? line.Debit  ?? 0);
    return bucket === 'income' ? (credit - debit) : (debit - credit);
  }
  return lineAmounts(item, line, rateByKey).net; // always a positive magnitude
}

// ── TRANSACTION AGGREGATOR ───────────────────────────────────
// Sums net activity per account GUID across all transaction
// batches for the given date range, restricted to P&L accounts
// (per the COA cache). Returns:
//   { byAccount: { [guid]: { amount, name, bucket, untaxedAmount } },
//     totals: { income, cogs, opex } }
async function aggregateAccountActivity(biz, periodStart, periodEnd, coa) {
  const batches = [
    'journal-entry-batch',
    'sales-invoice-batch',
    'purchase-invoice-batch',
    'receipt-batch',
    'payment-batch',
  ];

  const rateByKey = await loadTaxCodeRates(biz);
  const byAccount = {};
  const totals = { income: 0, cogs: 0, opex: 0 };

  function ensure(guid) {
    if (!byAccount[guid]) {
      const meta = coa[guid] || {};
      byAccount[guid] = { key: guid, name: meta.name || '(Unknown account)', bucket: meta.bucket || 'other', amount: 0, untaxedAmount: 0 };
    }
    return byAccount[guid];
  }

  function applyLine(line, item, dateStr) {
    if (!inRange(dateStr, periodStart, periodEnd)) return;
    const guid = line.account || line.Account;
    if (!guid) return;
    const meta = coa[guid];
    if (!meta || !meta.isProfitAndLossAccount) return;

    const amount = pnlLineAmount(item, line, rateByKey, meta.bucket);

    const row = ensure(guid);
    row.amount += amount;
    if (!pnlLineTaxCodeKey(line)) row.untaxedAmount += amount;

    if (meta.bucket === 'income') totals.income += amount;
    else if (meta.bucket === 'cogs') totals.cogs += amount;
    else if (meta.bucket === 'opex') totals.opex += amount;
  }

  for (const batchPath of batches) {
    const items = await fetchAllBatch(`/api4/${batchPath}`, biz);
    for (const it of items) {
      const v = it.item || it.value || it;
      const date = v.date || v.issueDate || v.invoiceDate || v.receiptDate || v.paymentDate;
      const lines = v.Lines || v.lines || v.invoiceLines || v.receiptLines || v.paymentLines || v.journalEntryLines || [];
      for (const line of lines) applyLine(line, v, date);
    }
  }

  return { byAccount, totals };
}

// ── PREPAID TAX ASSET (CREDITABLE WITHHOLDING TAX) BALANCE ───
// Looks up the running balance of "Prepaid Tax Asset-2306"
// (individual) or "Prepaid Tax Asset-2307" (corporate) as of a
// given cutoff date, by summing debit-credit (or, for invoice/
// receipt/payment lines that only carry qty+unitPrice, the computed
// net amount) on that account from all transactions up to (and
// including) the cutoff.
async function getPrepaidTaxAssetBalance(biz, coa, cutoffDate, accountNameSubstr) {
  const account = findAccountByName(coa, accountNameSubstr);
  if (!account) return 0;

  const rateByKey = await loadTaxCodeRates(biz);
  const batches = [
    'journal-entry-batch',
    'sales-invoice-batch',
    'purchase-invoice-batch',
    'receipt-batch',
    'payment-batch',
  ];

  let balance = 0;
  for (const batchPath of batches) {
    const items = await fetchAllBatch(`/api4/${batchPath}`, biz);
    for (const it of items) {
      const v = it.item || it.value || it;
      const date = v.date || v.issueDate || v.invoiceDate || v.receiptDate || v.paymentDate;
      if (!date || new Date(date) > cutoffDate) continue;
      const lines = v.Lines || v.lines || v.invoiceLines || v.receiptLines || v.paymentLines || v.journalEntryLines || [];
      for (const line of lines) {
        const guid = line.account || line.Account;
        if (guid !== account.key) continue;
        const hasCredit = line.credit !== undefined || line.Credit !== undefined;
        const hasDebit  = line.debit  !== undefined || line.Debit  !== undefined;
        if (hasCredit || hasDebit) {
          balance += Number(line.debit ?? line.Debit ?? 0) - Number(line.credit ?? line.Credit ?? 0);
        } else {
          balance += lineAmounts(v, line, rateByKey).net;
        }
      }
    }
  }
  return balance;
}
