/* ============================================================
   Tallo CPA - Philippines BIR Extension
   chart-of-accounts.js - COA builder tab: create/rename Manager
   GL accounts and groups, and map every account to one of the
   9 BIR income-tax categories used by 1701/1701Q/1702Q/1702RT.

   Also exposes a reusable account-picker (COA.accountOptionsHtml)
   used by the Payslip Items tab (expense/liability accounts) and
   the Tax Codes tab (VAT account overrides).

   Uses postMessage bridge (apiRequest from shared.js), and the
   read-only loadChartOfAccounts()/loadAccountGroups() caches from
   pnl-helpers.js. Mapping persisted via getCoaMapping/saveCoaMapping
   (shared.js), which share Manager's 'BIR Mapping Data' field.
   ============================================================ */

(function () {

  // ── BIR INCOME-TAX CATEGORIES ────────────────────────────────
  // 1:1 with account "type" — picking a category also tells us which
  // Manager endpoint (balance-sheet vs profit-and-loss) to use.
  var BIR_COA_CATEGORIES = [
    { id: 'acct-bir-asset',    label: 'Asset',              isPnL: false },
    { id: 'acct-bir-liab',     label: 'Liabilities',        isPnL: false },
    { id: 'acct-bir-equity',   label: 'Equity',             isPnL: false },
    { id: 'acct-bir-revenue',  label: 'Revenue',            isPnL: true  },
    { id: 'acct-bir-cogs',     label: 'Cost of Sales',      isPnL: true  },
    { id: 'acct-bir-cos',      label: 'Cost of Services',   isPnL: true  },
    { id: 'acct-bir-opex',     label: 'Operating Expenses', isPnL: true  },
    { id: 'acct-bir-oincome',  label: 'Other Income',       isPnL: true  },
    { id: 'acct-bir-oexpense', label: 'Other Expense',      isPnL: true  },
  ];

  function catById(id) {
    return BIR_COA_CATEGORIES.find(function (c) { return c.id === id; });
  }

  // ── Local helpers (kept self-contained, same pattern as custom-fields.js) ──
  function esc(s) {
    return String(s != null ? s : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function biz() {
    var sel = document.getElementById('business');
    return sel ? sel.value : '';
  }
  function noBusinessMsg() {
    return '<p class="muted">Select a business above to build its chart of accounts.</p>';
  }
  function spinner(msg) {
    return '<div class="status">' + esc(msg) + '</div>';
  }
  function flash(btn, ok) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = ok ? '✓ Saved' : '✗ Failed';
    setTimeout(function () { btn.textContent = orig; }, 1400);
  }

  // ── PUBLIC: reusable account picker (used by Payslip Items & Tax Codes tabs) ──
  // coa: result of loadChartOfAccounts(biz) -- { guid: {key,name,group,isProfitAndLossAccount} }
  // opts.isPnL: if set, filter to only P&L or only Balance Sheet accounts
  // opts.selected: currently selected account guid
  function accountOptionsHtml(coa, opts) {
    opts = opts || {};
    var list = Object.values(coa || {});
    if (typeof opts.isPnL === 'boolean') {
      list = list.filter(function (a) { return a.isProfitAndLossAccount === opts.isPnL; });
    }
    list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    var html = '<option value="">-- none --</option>';
    list.forEach(function (a) {
      var sel = a.key === opts.selected ? ' selected' : '';
      html += '<option value="' + esc(a.key) + '"' + sel + '>' + esc(a.name) + '</option>';
    });
    return html;
  }

  // ── MOUNT ─────────────────────────────────────────────────────
  function mountCoaSection(container) {
    var coa = {};       // accountGuid -> {key,name,group,isProfitAndLossAccount}
    var groups = { pnl: [], bs: [] };
    var coaMap = {};    // accountGuid -> 'acct-bir-<category>'

    async function refresh() {
      var business = biz();
      if (!business) { container.innerHTML = noBusinessMsg(); return; }
      container.innerHTML = spinner('Loading chart of accounts...');
      var loadError = '';
      try {
        coa = await loadChartOfAccounts(business, true);
      } catch (err) {
        console.error('[COA] loadChartOfAccounts failed:', err);
        coa = {};
        loadError += 'Accounts: ' + err.message + '. ';
      }
      try {
        groups = await loadAccountGroups(business, true);
      } catch (err) {
        console.error('[COA] loadAccountGroups failed:', err);
        groups = { pnl: [], bs: [] };
        loadError += 'Groups: ' + err.message + '. ';
      }
      try {
        coaMap = await getCoaMapping(business);
      } catch (err) {
        console.error('[COA] getCoaMapping failed:', err);
        coaMap = {};
        loadError += 'Mapping: ' + err.message + '. ';
      }
      console.log('[COA] loaded', Object.keys(coa).length, 'accounts;', groups.pnl.length, 'P&L groups;', groups.bs.length, 'balance-sheet groups.');
      render(loadError);
    }

    function groupOptionsHtml(isPnL, selected) {
      var list = isPnL ? groups.pnl : groups.bs;
      var html = '<option value="">-- none --</option>';
      list.forEach(function (g) {
        var sel = g.key === selected ? ' selected' : '';
        html += '<option value="' + esc(g.key) + '"' + sel + '>' + esc(g.name) + '</option>';
      });
      html += '<option value="__new__">+ New group...</option>';
      return html;
    }

    function buildCreatorHtml() {
      var catOpts = BIR_COA_CATEGORIES.map(function (c) {
        return '<option value="' + esc(c.id) + '" data-pnl="' + c.isPnL + '">' + esc(c.label) + '</option>';
      }).join('');
      var firstCat = BIR_COA_CATEGORIES[0];
      return '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:18px;">' +
        '<div style="font-size:12px;font-weight:700;color:#0d1b3e;margin-bottom:10px;">➕ Create New Account</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Account Name</label>' +
            '<input id="coa-new-name" type="text" placeholder="e.g. Office Supplies Expense" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:5px;width:220px;" /></div>' +
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Code</label>' +
            '<input id="coa-new-code" type="text" placeholder="optional" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:5px;width:90px;" /></div>' +
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">BIR Category</label>' +
            '<select id="coa-new-cat" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:5px;min-width:180px;" onchange="window._coaOnCat()">' + catOpts + '</select></div>' +
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:3px;">Group / Heading</label>' +
            '<select id="coa-new-group" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:5px;min-width:200px;" onchange="window._coaOnGroupSel()">' + groupOptionsHtml(firstCat.isPnL, '') + '</select>' +
            '<input id="coa-new-group-name" type="text" placeholder="New group name" style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:5px;width:200px;margin-top:5px;display:none;" /></div>' +
          '<button class="btn btn-primary" onclick="window._coaCreate()" style="white-space:nowrap;align-self:flex-end;padding:6px 16px;">✦ Create</button>' +
        '</div>' +
        '<div id="coa-new-msg" style="margin-top:7px;font-size:11px;min-height:14px;"></div>' +
      '</div>';
    }

    function render(loadError) {
      var intro = '<p style="font-size:11px;color:#6b7280;margin-bottom:14px;">Create accounts here, or map accounts Manager already has to a BIR income-tax category so 1701/1701Q/1702Q/1702RT can classify them correctly.</p>' +
        '<p style="font-size:11px;color:#9ca3af;margin-bottom:14px;">Loaded ' + Object.keys(coa).length + ' account(s), ' + (groups.pnl.length + groups.bs.length) + ' group(s).</p>';
      var errorBanner = loadError ? '<div class="alert alert-error" style="margin-bottom:14px;">⚠ ' + esc(loadError) + '</div>' : '';
      container.innerHTML = errorBanner + buildCreatorHtml() + intro + BIR_COA_CATEGORIES.map(renderCategoryTable).join('') + renderUnmappedTable();

      window._coaOnCat = function () {
        var sel = document.getElementById('coa-new-cat');
        var cat = catById(sel.value);
        document.getElementById('coa-new-group').innerHTML = groupOptionsHtml(cat.isPnL, '');
        document.getElementById('coa-new-group-name').style.display = 'none';
        document.getElementById('coa-new-group-name').value = '';
      };
      window._coaOnGroupSel = function () {
        var v = document.getElementById('coa-new-group').value;
        document.getElementById('coa-new-group-name').style.display = v === '__new__' ? 'block' : 'none';
      };
      window._coaCreate = onCreateAccount;

      container.querySelectorAll('[data-action="coa-save-row"]').forEach(function (btn) {
        btn.addEventListener('click', onSaveRow);
      });
    }

    function accountsForCategory(catId) {
      return Object.keys(coaMap)
        .filter(function (guid) { return coaMap[guid] === catId; })
        .map(function (guid) { return coa[guid]; })
        .filter(Boolean)
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    }

    function groupNameFor(guid, isPnL) {
      var list = isPnL ? groups.pnl : groups.bs;
      var g = list.find(function (x) { return x.key === guid; });
      return g ? g.name : '—';
    }

    function categoryRow(cat, acct) {
      var catOpts = BIR_COA_CATEGORIES.map(function (c) {
        var sel = c.id === cat.id ? ' selected' : '';
        return '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.label) + '</option>';
      }).join('');
      return '<tr data-key="' + esc(acct.key) + '" style="border-bottom:.5px solid #f3f4f6;">' +
        '<td style="padding:6px 8px;"><input data-role="name" type="text" value="' + esc(acct.name) + '" style="font-size:12px;width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:3px 6px;" /></td>' +
        '<td style="padding:6px 8px;font-size:12px;color:#6b7280;">' + esc(groupNameFor(acct.group, acct.isProfitAndLossAccount)) + '</td>' +
        '<td style="padding:6px 8px;"><select data-role="cat" style="width:100%;font-size:12px;">' + catOpts + '</select></td>' +
        '<td style="padding:6px 8px;"><button class="btn btn-primary btn-sm" data-action="coa-save-row" style="font-size:11px;">Save</button></td>' +
        '</tr>';
    }

    function renderCategoryTable(cat) {
      var accts = accountsForCategory(cat.id);
      var heading = '<h3 style="margin:16px 0 6px;font-size:13px;font-weight:500;">' + esc(cat.label) + '</h3>';
      if (!accts.length) return heading + '<p class="muted">No accounts mapped to ' + esc(cat.label.toLowerCase()) + ' yet.</p>';
      var rows = accts.map(function (a) { return categoryRow(cat, a); }).join('');
      return heading +
        '<div style="overflow-x:auto;margin-bottom:8px;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="font-size:11px;color:#9ca3af;">' +
        '<th style="text-align:left;padding:5px 8px;font-weight:500;">Account</th>' +
        '<th style="text-align:left;padding:5px 8px;font-weight:500;">Group</th>' +
        '<th style="padding:5px 8px;font-weight:500;">BIR Category</th>' +
        '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function renderUnmappedTable() {
      var unmapped = Object.values(coa).filter(function (a) { return !coaMap[a.key]; })
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      var heading = '<h3 style="margin:20px 0 6px;font-size:13px;font-weight:500;color:#b45309;">⚠ Not yet mapped</h3>';
      if (!unmapped.length) return heading + '<p class="muted">All accounts are mapped.</p>';
      var rows = unmapped.map(function (a) {
        var defaultCat = a.isProfitAndLossAccount ? 'acct-bir-opex' : 'acct-bir-asset';
        var catOpts = BIR_COA_CATEGORIES
          .filter(function (c) { return c.isPnL === a.isProfitAndLossAccount; })
          .map(function (c) {
            var sel = c.id === defaultCat ? ' selected' : '';
            return '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.label) + '</option>';
          }).join('');
        return '<tr data-key="' + esc(a.key) + '" style="border-bottom:.5px solid #f3f4f6;">' +
          '<td style="padding:6px 8px;"><input data-role="name" type="text" value="' + esc(a.name) + '" style="font-size:12px;width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:3px 6px;" /></td>' +
          '<td style="padding:6px 8px;font-size:12px;color:#6b7280;">' + esc(groupNameFor(a.group, a.isProfitAndLossAccount)) + '</td>' +
          '<td style="padding:6px 8px;"><select data-role="cat" style="width:100%;font-size:12px;"><option value="">-- pick category --</option>' + catOpts + '</select></td>' +
          '<td style="padding:6px 8px;"><button class="btn btn-primary btn-sm" data-action="coa-save-row" style="font-size:11px;">Save</button></td>' +
          '</tr>';
      }).join('');
      return heading +
        '<div style="overflow-x:auto;margin-bottom:8px;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="font-size:11px;color:#9ca3af;">' +
        '<th style="text-align:left;padding:5px 8px;font-weight:500;">Account</th>' +
        '<th style="text-align:left;padding:5px 8px;font-weight:500;">Group</th>' +
        '<th style="padding:5px 8px;font-weight:500;">BIR Category</th>' +
        '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    async function onCreateAccount() {
      var business = biz();
      var msgEl = document.getElementById('coa-new-msg');
      var name = (document.getElementById('coa-new-name').value || '').trim();
      var code = (document.getElementById('coa-new-code').value || '').trim();
      var catSel = document.getElementById('coa-new-cat');
      var cat = catById(catSel.value);
      var groupSel = document.getElementById('coa-new-group');
      var groupVal = groupSel.value;
      var newGroupName = (document.getElementById('coa-new-group-name').value || '').trim();

      if (!name) { msgEl.innerHTML = '<span style="color:#c0392b;">Please enter an account name.</span>'; return; }
      if (groupVal === '__new__' && !newGroupName) { msgEl.innerHTML = '<span style="color:#c0392b;">Please enter a name for the new group.</span>'; return; }

      msgEl.innerHTML = '<span style="color:#6b7280;">Creating…</span>';
      try {
        var groupGuid = groupVal;
        if (groupVal === '__new__') {
          var groupEndpoint = cat.isPnL ? '/api4/profit-and-loss-statement-group' : '/api4/balance-sheet-group';
          var createdGroup = await apiRequest('POST', groupEndpoint, { business: business, value: { name: newGroupName } });
          groupGuid = (createdGroup && (createdGroup.key || createdGroup.Key)) || null;
          if (!groupGuid) throw new Error('Could not create group');
        }

        var acctEndpoint = cat.isPnL ? '/api4/profit-and-loss-statement-account' : '/api4/balance-sheet-account';
        var acctValue = { name: name, group: groupGuid || null };
        if (code) acctValue.code = code;
        var createdAcct = await apiRequest('POST', acctEndpoint, { business: business, value: acctValue });
        var acctGuid = (createdAcct && (createdAcct.key || createdAcct.Key)) || null;
        if (!acctGuid) throw new Error('Could not create account');

        coaMap[acctGuid] = cat.id;
        await saveCoaMapping(business, coaMap);

        document.getElementById('coa-new-name').value = '';
        document.getElementById('coa-new-code').value = '';
        invalidateCoaCache(business);
        invalidateAccountGroupsCache(business);
        await refresh();
        msgEl ? null : null;
        showToastSafe('✅ "' + name + '" created and mapped to ' + cat.label + '.');
      } catch (err) {
        msgEl.innerHTML = '<span style="color:#c0392b;">❌ ' + esc(err.message) + '</span>';
      }
    }

    async function onSaveRow(e) {
      var btn = e.currentTarget;
      var row = btn.closest('tr');
      var guid = row.dataset.key;
      var business = biz();
      var acct = coa[guid];
      if (!business || !acct) return;

      var newName = (row.querySelector('[data-role="name"]').value || '').trim();
      var newCat = row.querySelector('[data-role="cat"]').value || '';

      try {
        if (newName && newName !== acct.name) {
          var endpoint = acct.isProfitAndLossAccount ? '/api4/profit-and-loss-statement-account' : '/api4/balance-sheet-account';
          await apiRequest('PUT', endpoint, {
            business: business,
            key: guid,
            value: { name: newName, group: acct.group || null },
          });
          acct.name = newName;
          invalidateCoaCache(business);
        }
        if (newCat) {
          coaMap[guid] = newCat;
        } else {
          delete coaMap[guid];
        }
        await saveCoaMapping(business, coaMap);
        flash(btn, true);
        await refresh();
      } catch (err) {
        console.error(err);
        flash(btn, false);
      }
    }

    function showToastSafe(msg) {
      if (typeof showToast === 'function') showToast(msg, 'success');
    }

    return { refresh: refresh };
  }

  // ---- PUBLIC API ----
  window.COA = {
    mount: mountCoaSection,
    CATEGORIES: BIR_COA_CATEGORIES,
    accountOptionsHtml: accountOptionsHtml,
  };

})();
