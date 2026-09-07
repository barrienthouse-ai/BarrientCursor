const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const DAILY_FIELDS = [
  'inventoryValue', 'capitalLimit', 'payablesOpen', 'overstockValue',
  'n3mValue', 'n6mValue', 'retailSales', 'wholesaleSales', 'internalSales',
  'counterWaitMinutes', 'lostSalesCount', 'lostSalesDollars',
  'sopReceivedCount', 'sopAgedCount', 'sopAgedValue',
  'rimCompliancePercent', 'rimTargetPercent', 'emergencyOrderCount',
  'emergencyFreightCost', 'outstandingCoresValue', 'wholesaleStops',
  'hotshotRuns', 'deliveryFuelCost', 'notes'
];

const state = { snapshot: null, config: {} };

function $(id) {
  return document.getElementById(id);
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('.tab-page').forEach((page) => {
    page.classList.toggle('hidden', page.id !== name);
  });
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function pill(value) {
  return `<span class="pill ${escapeAttr(value || '')}">${escapeAttr(value || '')}</span>`;
}

function setCard(id, level) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.classList.remove('crit', 'warn', 'good');
  if (level) {
    el.classList.add(level);
  }
}

function renderBriefing(snapshot) {
  const capital = snapshot.capital || {};
  const sales = snapshot.sales || {};
  const report = snapshot.report || {};
  const rim = snapshot.rim || {};
  const waitLevel = snapshot.wait === 'ok' ? 'good' : snapshot.wait;
  $('kpiInventory').textContent = money.format(capital.inventoryValue || 0);
  $('kpiCapital').textContent = `${capital.overCapital ? 'OVER' : 'vs'} ${money.format(capital.capitalLimit || 0)} · ${capital.utilization != null ? `${(capital.utilization * 100).toFixed(0)}%` : '—'}`;
  setCard('kpiInventoryCard', capital.overCapital ? 'crit' : (capital.utilization >= 0.95 ? 'warn' : 'good'));
  $('kpiN6m').textContent = money.format(capital.n6mValue || 0);
  $('kpiN3m').textContent = `N3M ${money.format(capital.n3mValue || 0)} · ${capital.n6mShare != null ? `${(capital.n6mShare * 100).toFixed(1)}% of stock` : '—'}`;
  setCard('kpiN6mCard', capital.n6mShare >= 0.12 ? 'crit' : (capital.n6mShare >= 0.08 ? 'warn' : ''));
  $('kpiRim').textContent = rim.actual != null ? `${Number(rim.actual).toFixed(1)}%` : '—';
  $('kpiRimNote').textContent = rim.onTarget ? `At/above ${rim.target}% target` : `${rim.gap} pts short of ${rim.target}%`;
  setCard('kpiRimCard', rim.onTarget ? 'good' : 'warn');
  $('kpiWait').textContent = `${qty.format(report.counterWaitMinutes || 0)} min`;
  setCard('kpiWaitCard', waitLevel);
  $('kpiSales').textContent = money.format(sales.totalSales || 0);
  $('kpiSalesMonth').textContent = `MTD ${money.format(snapshot.month?.sales?.totalSales || 0)} · retail ${money.format(sales.retailSales || 0)}`;
  $('kpiLost').textContent = money.format(report.lostSalesDollars || 0);
  $('kpiLostNote').textContent = `${snapshot.lostSales.openCount} open LSL · ${snapshot.lostSales.repeats.length} repeat parts`;
  setCard('kpiLostCard', snapshot.lostSales.repeats.length ? 'warn' : '');
  $('kpiSop').textContent = String(snapshot.sop.agedCount || 0);
  $('kpiSopNote').textContent = `${snapshot.sop.recCount} in REC · ${money.format(snapshot.sop.agedValue || 0)} aged`;
  setCard('kpiSopCard', snapshot.sop.agedCount ? 'crit' : (snapshot.sop.bottleneckCount ? 'warn' : 'good'));
  $('kpiCores').textContent = money.format(snapshot.cores.dollars || 0);
  $('kpiCoreNote').textContent = `${snapshot.cores.openCount} outstanding · ${snapshot.cores.agedCount} aged 14+`;
  setCard('kpiCoreCard', snapshot.cores.agedCount ? 'crit' : (snapshot.cores.dollars >= 1500 ? 'warn' : ''));
  $('kpiOverstock').textContent = money.format(capital.overstockValue || 0);
  $('kpiCso').textContent = String(report.emergencyOrderCount || 0);
  $('kpiFreight').textContent = `Freight ${moneyExact.format(report.emergencyFreightCost || 0)}`;
  $('kpiBo').textContent = String(snapshot.backorders.criticalCount || 0);
  $('kpiBoNote').textContent = `${snapshot.backorders.openCount} open backorders`;
  setCard('kpiBoCard', snapshot.backorders.criticalCount ? 'crit' : '');
  $('kpiRoute').textContent = `${report.wholesaleStops || 0} / ${report.hotshotRuns || 0}`;
  $('kpiFuel').textContent = `${report.wholesaleStops || 0} stops · ${report.hotshotRuns || 0} hot-shots · ${money.format(report.deliveryFuelCost || 0)} fuel`;

  $('flagList').innerHTML = snapshot.flags.alerts.length
    ? snapshot.flags.alerts.map((item) => (
      `<div class="flag ${item.level}"><h3>${escapeAttr(item.title)}</h3><p class="meta">${escapeAttr(item.detail)}</p></div>`
    )).join('')
    : '<p class="meta">No flags. Capital, wait, RIM, SOP, and cores are inside the daily guardrails.</p>';

  $('repeatList').innerHTML = snapshot.lostSales.repeats.length
    ? snapshot.lostSales.repeats.map((item) => (
      `<p><strong>${escapeAttr(item.partNumber)}</strong> ${pill('open')}<br>${escapeAttr(item.description || '')} · ${item.hits} hits · ${money.format(item.dollars)}</p>`
    )).join('')
    : '<p class="meta">No repeat lost-sale part numbers this week.</p>';

  $('sopList').innerHTML = snapshot.sop.rec.length
    ? snapshot.sop.rec.map((item) => (
      `<p><strong>${escapeAttr(item.partNumber)}</strong> ${pill(item.ageStatus || 'rec')}<br>${escapeAttr(item.customer || 'Customer n/a')} · ${escapeAttr(item.roNumber || 'RO n/a')} · ${item.ageDays} days · ${money.format(item.dollars)}</p>`
    )).join('')
    : '<p class="meta">No special orders sitting in REC.</p>';

  const holds = [
    ...snapshot.backorders.critical.map((item) => (
      `<p><strong>${escapeAttr(item.partNumber)}</strong> ${pill(item.severity)}<br>${escapeAttr(item.vehicle || item.reason || '')} · ETA ${escapeAttr(item.eta || 'n/a')}</p>`
    )),
    ...snapshot.cores.aged.map((item) => (
      `<p><strong>${escapeAttr(item.partNumber)}</strong> ${pill('outstanding')}<br>Core ${escapeAttr(item.accountOrTech || '')} · ${money.format(item.dollars)}</p>`
    ))
  ];
  $('holdList').innerHTML = holds.length ? holds.join('') : '<p class="meta">No critical backorders or aged cores.</p>';
}

function readDailyPayload() {
  const payload = { date: $('reportDate').value };
  for (const field of DAILY_FIELDS) {
    payload[field] = $(field).value;
  }
  payload.to = $('reportEmail').value;
  return payload;
}

function fillDailyForm(snapshot) {
  const report = snapshot.report || {};
  for (const field of DAILY_FIELDS) {
    if ($(field)) {
      $(field).value = report[field] != null && report[field] !== '' ? report[field] : '';
    }
  }
  if (!report.capitalLimit) {
    $('capitalLimit').value = state.config.capitalLimit || 500000;
  }
  if (!report.rimTargetPercent) {
    $('rimTargetPercent').value = state.config.rimTargetPercent || 90;
  }
  $('reportEmail').value = state.config.reportEmail || '';
}

async function loadDay() {
  const date = $('reportDate').value;
  const snapshot = await api(`/api/summary?date=${encodeURIComponent(date)}`);
  state.snapshot = snapshot;
  renderBriefing(snapshot);
  fillDailyForm(snapshot);
  $('emailPreview').href = `/api/email-preview?date=${encodeURIComponent(date)}`;
  return snapshot;
}

async function loadHistory() {
  const { rows } = await api('/api/history');
  $('historyRows').innerHTML = rows.map((row) => (
    `<tr>
      <td>${row.date}</td>
      <td>${money.format(row.inventoryValue || 0)}</td>
      <td>${money.format(row.n6mValue || 0)}</td>
      <td>${money.format((row.retailSales || 0) + (row.wholesaleSales || 0) + (row.internalSales || 0))}</td>
      <td>${qty.format(row.counterWaitMinutes || 0)}</td>
      <td>${Number(row.rimCompliancePercent || 0).toFixed(1)}%</td>
      <td>${money.format(row.outstandingCoresValue || 0)}</td>
      <td>${row.emergencyOrderCount || 0}</td>
    </tr>`
  )).join('') || '<tr><td colspan="8">No saved days yet.</td></tr>';
}

function boardButtons(item, kind) {
  if (kind === 'lost') {
    return item.status === 'open'
      ? `<button class="btn ok" data-kind="lost" data-action="stock" data-id="${item.id}" type="button">Stock it</button>
         <button class="btn ghost" data-kind="lost" data-action="close" data-id="${item.id}" type="button">Close</button>`
      : `<button class="btn ghost" data-kind="lost" data-action="reopen" data-id="${item.id}" type="button">Reopen</button>`;
  }
  if (kind === 'sop') {
    return item.status === 'rec'
      ? `<button class="btn ok" data-kind="sop" data-action="install" data-id="${item.id}" type="button">Installed</button>
         <button class="btn warn" data-kind="sop" data-action="return" data-id="${item.id}" type="button">Return</button>`
      : `<button class="btn ghost" data-kind="sop" data-action="reopen" data-id="${item.id}" type="button">Reopen</button>`;
  }
  if (kind === 'backorder') {
    return item.status !== 'closed'
      ? `<button class="btn ok" data-kind="backorder" data-action="receive" data-id="${item.id}" type="button">Received</button>
         <button class="btn ghost" data-kind="backorder" data-action="close" data-id="${item.id}" type="button">Close</button>`
      : `<button class="btn ghost" data-kind="backorder" data-action="reopen" data-id="${item.id}" type="button">Reopen</button>`;
  }
  return item.status === 'outstanding'
    ? `<button class="btn ok" data-kind="core" data-action="return" data-id="${item.id}" type="button">Returned</button>`
    : `<button class="btn ghost" data-kind="core" data-action="reopen" data-id="${item.id}" type="button">Reopen</button>`;
}

async function loadBoards() {
  const [lost, sop, bo, cores] = await Promise.all([
    api('/api/lost-sales'),
    api('/api/sop'),
    api('/api/backorders'),
    api('/api/cores')
  ]);
  $('lostTable').innerHTML = lost.rows.map((item) => `
    <tr>
      <td><strong>${escapeAttr(item.partNumber)}</strong><br><span class="meta">${escapeAttr(item.description || '')}</span></td>
      <td>${escapeAttr(item.requestedBy || '—')}<br><span class="meta">${escapeAttr(item.source || '')}</span></td>
      <td>${item.timesRequested || 1}</td>
      <td>${money.format(item.dollars || 0)}</td>
      <td>${pill(item.status)}</td>
      <td>${boardButtons(item, 'lost')}</td>
    </tr>
  `).join('');
  $('sopTable').innerHTML = sop.rows.map((item) => `
    <tr>
      <td><strong>${escapeAttr(item.partNumber)}</strong><br><span class="meta">${escapeAttr(item.description || '')}</span></td>
      <td>${escapeAttr(item.customer || '—')}<br><span class="meta">${escapeAttr(item.roNumber || '')}</span></td>
      <td>${item.ageDays ?? '—'}d ${pill(item.ageStatus || item.status)}</td>
      <td>${money.format(item.dollars || 0)}</td>
      <td>${pill(item.status)}</td>
      <td>${boardButtons(item, 'sop')}</td>
    </tr>
  `).join('');
  $('boTable').innerHTML = bo.rows.map((item) => `
    <tr>
      <td><strong>${escapeAttr(item.partNumber)}</strong><br><span class="meta">${escapeAttr(item.description || '')}</span></td>
      <td>${escapeAttr(item.vehicle || item.reason || '')}<br>${pill(item.severity)}</td>
      <td>${pill(item.status)}</td>
      <td>${boardButtons(item, 'backorder')}</td>
    </tr>
  `).join('');
  $('coreTable').innerHTML = cores.rows.map((item) => `
    <tr>
      <td><strong>${escapeAttr(item.partNumber)}</strong><br><span class="meta">${escapeAttr(item.description || '')}</span></td>
      <td>${escapeAttr(item.accountOrTech || '—')}</td>
      <td>${money.format(item.dollars || 0)}</td>
      <td>${pill(item.status)}</td>
      <td>${boardButtons(item, 'core')}</td>
    </tr>
  `).join('');
}

async function loadCompat() {
  const audit = await api('/api/compatibility');
  $('compatAudit').innerHTML = `<p>Safe to install: <strong>${audit.safeToInstall ? 'yes' : 'no'}</strong></p>
    <p>Protected hits: ${audit.protectedHits.join(', ') || '(none in this preview)'}</p>`;
}

async function init() {
  $('reportDate').value = todayInputValue();
  $('sopReceived').value = todayInputValue();
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.addEventListener('click', async () => {
      setTab(button.dataset.tab);
      if (button.dataset.tab === 'history') {
        await loadHistory();
      }
      if (button.dataset.tab === 'boards') {
        await loadBoards();
      }
      if (button.dataset.tab === 'compat') {
        await loadCompat();
      }
    });
  });

  state.config = await api('/api/config');
  await loadDay();
  await loadBoards();

  $('recallBtn').addEventListener('click', async () => {
    await loadDay();
    setTab('daily');
    $('dailyStatus').textContent = `Recalled ${$('reportDate').value}.`;
    $('dailyStatus').className = 'notice';
  });
  $('reportDate').addEventListener('change', loadDay);

  $('saveDaily').addEventListener('click', async () => {
    $('dailyStatus').textContent = 'Saving…';
    $('dailyStatus').className = 'notice';
    try {
      const payload = readDailyPayload();
      await api('/api/daily-report', { method: 'POST', body: JSON.stringify(payload) });
      if (payload.to) {
        await api('/api/config', { method: 'PUT', body: JSON.stringify({ reportEmail: payload.to }) });
        state.config.reportEmail = payload.to;
      }
      await loadDay();
      $('dailyStatus').textContent = `Saved report for ${payload.date}.`;
    } catch (error) {
      $('dailyStatus').textContent = error.message;
      $('dailyStatus').className = 'error';
    }
  });

  $('emailReport').addEventListener('click', async () => {
    $('dailyStatus').textContent = 'Saving and building GM recap…';
    $('dailyStatus').className = 'notice';
    try {
      const result = await api('/api/email-report', {
        method: 'POST',
        body: JSON.stringify(readDailyPayload())
      });
      await loadDay();
      $('dailyStatus').textContent = result.message || (result.sent ? `Emailed ${result.to}` : `Saved. ${result.subject}`);
    } catch (error) {
      $('dailyStatus').textContent = error.message;
      $('dailyStatus').className = 'error';
    }
  });

  $('addLost').addEventListener('click', async () => {
    try {
      await api('/api/lost-sales', {
        method: 'POST',
        body: JSON.stringify({
          openedDate: $('reportDate').value,
          partNumber: $('lostPart').value,
          description: $('lostDesc').value,
          requestedBy: $('lostBy').value,
          source: $('lostSource').value,
          timesRequested: $('lostTimes').value,
          dollars: $('lostDollars').value,
          notes: $('lostNotes').value
        })
      });
      $('lostPart').value = '';
      $('lostDesc').value = '';
      $('lostNotes').value = '';
      $('lostStatus').textContent = 'Lost sale logged.';
      await loadBoards();
      await loadDay();
    } catch (error) {
      $('lostStatus').textContent = error.message;
      $('lostStatus').className = 'error';
    }
  });

  $('addSop').addEventListener('click', async () => {
    try {
      await api('/api/sop', {
        method: 'POST',
        body: JSON.stringify({
          receivedDate: $('sopReceived').value || $('reportDate').value,
          partNumber: $('sopPart').value,
          description: $('sopDesc').value,
          customer: $('sopCustomer').value,
          roNumber: $('sopRo').value,
          dollars: $('sopDollars').value,
          notes: $('sopNotes').value
        })
      });
      $('sopPart').value = '';
      $('sopDesc').value = '';
      $('sopCustomer').value = '';
      $('sopRo').value = '';
      $('sopStatus').textContent = 'SOP logged.';
      await loadBoards();
      await loadDay();
    } catch (error) {
      $('sopStatus').textContent = error.message;
      $('sopStatus').className = 'error';
    }
  });

  $('addBo').addEventListener('click', async () => {
    try {
      await api('/api/backorders', {
        method: 'POST',
        body: JSON.stringify({
          openedDate: $('reportDate').value,
          partNumber: $('boPart').value,
          description: $('boDesc').value,
          vehicle: $('boVehicle').value,
          reason: $('boReason').value,
          eta: $('boEta').value,
          severity: $('boSeverity').value
        })
      });
      $('boPart').value = '';
      $('boDesc').value = '';
      $('boStatus').textContent = 'Backorder logged.';
      await loadBoards();
      await loadDay();
    } catch (error) {
      $('boStatus').textContent = error.message;
      $('boStatus').className = 'error';
    }
  });

  $('addCore').addEventListener('click', async () => {
    try {
      await api('/api/cores', {
        method: 'POST',
        body: JSON.stringify({
          openedDate: $('reportDate').value,
          partNumber: $('corePart').value,
          description: $('coreDesc').value,
          accountOrTech: $('coreAccount').value,
          dollars: $('coreDollars').value
        })
      });
      $('corePart').value = '';
      $('coreDesc').value = '';
      $('coreStatus').textContent = 'Core logged.';
      await loadBoards();
      await loadDay();
    } catch (error) {
      $('coreStatus').textContent = error.message;
      $('coreStatus').className = 'error';
    }
  });

  const paths = { lost: '/api/lost-sales', sop: '/api/sop', backorder: '/api/backorders', core: '/api/cores' };
  document.getElementById('boards').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    let notes = '';
    if (button.dataset.action === 'close' || button.dataset.action === 'return') {
      notes = window.prompt('Notes for the GM briefing:', '') || '';
    }
    await api(`${paths[button.dataset.kind]}/${encodeURIComponent(button.dataset.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: button.dataset.action, notes })
    });
    await loadBoards();
    await loadDay();
  });
}

init().catch((error) => {
  $('dailyStatus').textContent = error.message;
  $('dailyStatus').className = 'error';
});
