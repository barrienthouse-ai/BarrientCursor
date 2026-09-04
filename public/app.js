const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const state = { snapshot: null, working: [], customers: [] };

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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function pct(value) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}

function gpu(amount, units) {
  return units > 0 ? money.format(amount / units) : '—';
}

function setTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('.tab-page').forEach((page) => {
    page.classList.toggle('hidden', page.id !== name);
  });
}

function num(id) {
  const value = $(id).value;
  return value === '' ? 0 : Number(value);
}

function liveTotals() {
  const sold = num('soldDeals');
  const front = num('frontGross');
  const finance = num('financeGross');
  const total = Math.round((front + finance) * 100) / 100;
  $('totalGross').value = total.toFixed(2);
  $('gpu').value = sold > 0 ? (total / sold).toFixed(2) : '';
  renderMtdStrip();
  renderBoardFromForm();
}

function renderMtdStrip() {
  const prior = state.snapshot?.monthlyPrior || {};
  const mtdSold = (Number(prior.soldDeals) || 0) + num('soldDeals');
  const mtdGross = (Number(prior.totalGross) || 0) + num('frontGross') + num('financeGross');
  $('mtdSold').value = qty.format(mtdSold);
  $('mtdGross').value = money.format(mtdGross);
}

function fillForm(report = {}, goal = {}) {
  $('soldDeals').value = report.soldDeals ?? '';
  $('workingDeals').value = report.workingDeals ?? '';
  $('frontGross').value = report.frontGross ?? '';
  $('financeGross').value = report.financeGross ?? '';
  $('deliveries').value = report.deliveries ?? '';
  $('courtesyDeliveries').value = report.courtesyDeliveries ?? '';
  $('expectedDeliveries').value = report.expectedDeliveries ?? '';
  $('notes').value = report.notes || '';
  $('unitGoal').value = goal.unitGoal ?? '';
  $('grossGoal').value = goal.grossGoal ?? '';
  liveTotals();
}

function readForm() {
  return {
    date: $('reportDate').value,
    soldDeals: num('soldDeals'),
    workingDeals: num('workingDeals'),
    frontGross: num('frontGross'),
    financeGross: num('financeGross'),
    deliveries: num('deliveries'),
    courtesyDeliveries: num('courtesyDeliveries'),
    expectedDeliveries: num('expectedDeliveries'),
    notes: $('notes').value
  };
}

function renderDealHint(dealLog) {
  const last = dealLog?.lastFleetDate || '';
  state.lastFleetDate = last;
  $('lastDealNote').textContent = last
    ? `Last fleet day in DEALINPUT: ${last}`
    : 'Last fleet day in DEALINPUT: (none found)';
  if (!dealLog || !dealLog.daily) {
    $('dealHint').textContent = 'Deal log: —';
    return;
  }
  const daily = dealLog.daily;
  $('dealHint').textContent = `Deal log: ${daily.soldDeals} fleet units · ${money.format(daily.frontGross)} front · ${money.format(daily.financeGross)} finance · ${money.format(daily.totalGross)} total`;
}

function renderBoardFromForm() {
  const snapshot = state.snapshot || {};
  const prior = snapshot.monthlyPrior || {};
  const working = snapshot.working || {};
  const goal = {
    unitGoal: num('unitGoal') || Number(snapshot.goal?.unitGoal || 0),
    grossGoal: num('grossGoal') || Number(snapshot.goal?.grossGoal || 0)
  };
  const sold = num('soldDeals');
  const front = num('frontGross');
  const finance = num('financeGross');
  const total = front + finance;
  const mtdSold = (Number(prior.soldDeals) || 0) + sold;
  const mtdFront = (Number(prior.frontGross) || 0) + front;
  const mtdFinance = (Number(prior.financeGross) || 0) + finance;
  const mtdGross = (Number(prior.totalGross) || 0) + total;
  const mtdDeliveries = (Number(prior.deliveries) || 0) + num('deliveries');
  const mtdCourtesy = (Number(prior.courtesyDeliveries) || 0) + num('courtesyDeliveries');
  const expected = num('expectedDeliveries') || Number(working.expectedUnits || 0);

  $('kpiWorking').textContent = qty.format(num('workingDeals') || working.openCount || 0);
  $('kpiWorkingNote').textContent = `${qty.format(working.workingUnits || 0)} units still working · ${qty.format(working.soldOpenCount || 0)} sold awaiting delivery`;
  $('kpiSold').textContent = qty.format(sold);
  $('kpiSoldNote').textContent = snapshot.unitsSource === 'deal-log'
    ? `Filled from DEALINPUT · MTD ${qty.format(mtdSold)}`
    : snapshot.saved
      ? `Saved recap · MTD ${qty.format(mtdSold)}`
      : `Draft · MTD ${qty.format(mtdSold)}`;
  $('kpiGpu').textContent = gpu(total, sold);
  $('kpiGpuNote').textContent = `MTD ${gpu(mtdGross, mtdSold)}`;
  $('kpiGoal').textContent = goal.unitGoal ? `${qty.format(mtdSold)} / ${qty.format(goal.unitGoal)}` : '—';
  $('kpiGoalNote').textContent = goal.unitGoal ? `Pace ${pct(mtdSold / goal.unitGoal)}` : 'Set a unit goal on Daily entry';
  $('kpiMtdFront').textContent = money.format(mtdFront);
  $('kpiFrontToday').textContent = `Today ${money.format(front)}`;
  $('kpiFinance').textContent = money.format(finance);
  $('kpiFinanceMtd').textContent = `MTD ${money.format(mtdFinance)}`;
  $('kpiTotal').textContent = money.format(total);
  $('kpiTotalMtd').textContent = `MTD ${money.format(mtdGross)}`;
  $('kpiGoalLeft').textContent = goal.unitGoal ? qty.format(Math.max(0, goal.unitGoal - mtdSold)) : '—';
  $('kpiGoalGross').textContent = goal.grossGoal
    ? `Gross remaining ${money.format(Math.max(0, goal.grossGoal - mtdGross))}`
    : 'Set a gross goal on Daily entry';
  $('kpiDeliveries').textContent = qty.format(num('deliveries'));
  $('kpiDeliveriesMtd').textContent = `MTD ${qty.format(mtdDeliveries)}`;
  $('kpiCourtesy').textContent = qty.format(num('courtesyDeliveries'));
  $('kpiCourtesyMtd').textContent = `MTD ${qty.format(mtdCourtesy)}`;
  $('kpiExpected').textContent = qty.format(expected);
  $('kpiExpectedNote').textContent = `Pipeline ${qty.format(working.expectedUnits || 0)}`;
  $('kpiExpectedTotal').textContent = qty.format(expected);
  $('kpiExpectedToday').textContent = `Due today ${qty.format(working.expectedTodayUnits || 0)}`;
  $('expectedHint').textContent = `Pipeline expected: ${qty.format(working.expectedUnits || 0)} · due today ${qty.format(working.expectedTodayUnits || 0)}`;

  const weekly = snapshot.weekly || {};
  const rows = [
    ['Sold deals', sold, mtdSold, weekly.soldDeals],
    ['Working deals', num('workingDeals'), num('workingDeals'), weekly.workingDeals],
    ['Front gross', money.format(front), money.format(mtdFront), money.format(weekly.frontGross || 0)],
    ['Finance gross', money.format(finance), money.format(mtdFinance), money.format(weekly.financeGross || 0)],
    ['Total gross', money.format(total), money.format(mtdGross), money.format(weekly.totalGross || 0)],
    ['GPU', gpu(total, sold), gpu(mtdGross, mtdSold), gpu(weekly.totalGross || 0, weekly.soldDeals || 0)],
    ['Deliveries', num('deliveries'), mtdDeliveries, weekly.deliveries],
    ['Courtesy deliveries', num('courtesyDeliveries'), mtdCourtesy, weekly.courtesyDeliveries],
    ['Expected deliveries', expected, expected, weekly.expectedDeliveries]
  ];
  $('compareTable').innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? 0}</td>`).join('')}</tr>`).join('');
}

function renderOpenDeals(rows = []) {
  const open = rows.filter((row) => row.status === 'working' || row.status === 'sold');
  if (!open.length) {
    $('openDealList').innerHTML = '<p class="meta">No open working deals.</p>';
    return;
  }
  $('openDealList').innerHTML = open.map((row) => `
    <div class="deal-card">
      <strong>${escapeHtml(row.account || row.customer || 'Fleet deal')}</strong>
      <span class="pill ${row.status}">${row.status}</span>
      <div class="meta">${qty.format(row.units || 1)} unit${Number(row.units) === 1 ? '' : 's'} · ${escapeHtml(row.vehicle || 'Vehicle TBD')} · expected ${row.expectedDelivery || '—'}</div>
    </div>
  `).join('');
}

function renderDealTable(rows = []) {
  if (!rows.length) {
    $('dealTable').innerHTML = '<tr><td colspan="8">No working deals logged yet.</td></tr>';
    return;
  }
  $('dealTable').innerHTML = [...rows].reverse().map((row) => `
    <tr>
      <td>${escapeHtml(row.account || '')}</td>
      <td>${escapeHtml(row.customer || '')}</td>
      <td>${escapeHtml(row.vehicle || '')}${row.stock ? `<div class="meta">${escapeHtml(row.stock)}</div>` : ''}</td>
      <td>${row.units}</td>
      <td>${row.expectedDelivery || '—'}</td>
      <td>${money.format((Number(row.frontGross) || 0) + (Number(row.financeGross) || 0))}</td>
      <td><span class="pill ${row.status}">${row.status}</span></td>
      <td>
        ${row.status === 'working' ? `<button class="btn ok" data-action="sold" data-id="${escapeHtml(row.id)}" type="button">Sold</button>` : ''}
        ${row.status === 'working' || row.status === 'sold' ? `<button class="btn" data-action="deliver" data-id="${escapeHtml(row.id)}" type="button">Deliver</button>` : ''}
        ${row.status === 'working' ? `<button class="btn danger" data-action="dead" data-id="${escapeHtml(row.id)}" type="button">Dead</button>` : ''}
        ${row.status === 'delivered' || row.status === 'dead' ? `<button class="btn ghost" data-action="reopen" data-id="${escapeHtml(row.id)}" type="button">Reopen</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderHistory(rows) {
  if (!rows.length) {
    $('historyTable').innerHTML = '<tr><td colspan="10">No recaps saved yet.</td></tr>';
    return;
  }
  $('historyTable').innerHTML = [...rows].reverse().map((row) => `
    <tr>
      <td>${row.date}</td>
      <td>${row.soldDeals}</td>
      <td>${row.workingDeals}</td>
      <td>${money.format(row.frontGross || 0)}</td>
      <td>${money.format(row.financeGross || 0)}</td>
      <td>${money.format(row.totalGross || 0)}</td>
      <td>${gpu(row.totalGross, row.soldDeals)}</td>
      <td>${row.deliveries}</td>
      <td>${row.courtesyDeliveries}</td>
      <td>${row.expectedDeliveries}</td>
    </tr>
  `).join('');
}

function fillCustomers(list = []) {
  state.customers = list;
  $('accountList').innerHTML = list.map((name) => `<option value="${escapeAttr(name)}"></option>`).join('');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function loadWorking() {
  const result = await api('/api/working-deals?status=all');
  state.working = result.rows || [];
  renderDealTable(state.working);
  renderOpenDeals(state.working);
}

async function loadDay(date) {
  if (!date) {
    return null;
  }
  const snapshot = await api(`/api/summary?date=${encodeURIComponent(date)}`);
  state.snapshot = snapshot;
  fillForm(snapshot.report, snapshot.goal || {});
  renderDealHint(snapshot.dealLog);
  renderBoardFromForm();
  renderOpenDeals(snapshot.working?.open || state.working);
  const history = await api('/api/history');
  renderHistory(history.rows || []);
  return snapshot;
}

function fillStatus(snapshot) {
  const date = snapshot?.date || $('reportDate').value;
  const deals = snapshot?.dealLog?.daily?.dealCount || 0;
  const last = snapshot?.dealLog?.lastFleetDate;
  if (deals) {
    setStatus(`Filled ${deals} fleet deal${deals === 1 ? '' : 's'} from DEALINPUT on ${date}. Enter deliveries and save.`);
    return;
  }
  const lastNote = last ? ` Last fleet day in DEALINPUT is ${last}.` : '';
  setStatus(snapshot?.saved
    ? `No fleet deals in DEALINPUT on ${date}. Showing the saved recap.${lastNote}`
    : `No fleet deals in DEALINPUT on ${date}.${lastNote} Enter sold deals, gross, and deliveries.`);
}

function setStatus(message, isError = false, id = 'dailyStatus') {
  const el = $(id);
  el.textContent = message;
  el.className = isError ? 'notice error' : 'notice';
}

document.querySelectorAll('.tabs button').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});

['soldDeals', 'workingDeals', 'frontGross', 'financeGross', 'deliveries', 'courtesyDeliveries', 'expectedDeliveries', 'unitGoal', 'grossGoal'].forEach((id) => {
  $(id).addEventListener('input', liveTotals);
});

$('recallBtn').addEventListener('click', async () => {
  try {
    const snapshot = await loadDay($('reportDate').value);
    fillStatus(snapshot);
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('reportDate').addEventListener('change', async () => {
  try {
    const snapshot = await loadDay($('reportDate').value);
    fillStatus(snapshot);
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('fillDealLog').addEventListener('click', async () => {
  try {
    const filled = await api('/api/fill-from-deal-log', {
      method: 'POST',
      body: JSON.stringify(readForm())
    });
    fillForm(filled.report, state.snapshot?.goal || {});
    renderDealHint(filled.dealLog);
    setStatus('Sold units and gross refreshed from DEALINPUT. Deliveries were kept. Save to lock the recap.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('saveGoal').addEventListener('click', async () => {
  try {
    const result = await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        date: $('reportDate').value,
        month: $('reportDate').value.slice(0, 7),
        unitGoal: num('unitGoal'),
        grossGoal: num('grossGoal')
      })
    });
    state.snapshot = result.snapshot;
    fillForm(state.snapshot.report, result.goal);
    setStatus(`Saved ${result.goal.month} goal: ${qty.format(result.goal.unitGoal)} units / ${money.format(result.goal.grossGoal)}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('saveDaily').addEventListener('click', async () => {
  try {
    if (num('unitGoal') || num('grossGoal')) {
      await api('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          date: $('reportDate').value,
          month: $('reportDate').value.slice(0, 7),
          unitGoal: num('unitGoal'),
          grossGoal: num('grossGoal')
        })
      });
    }
    const snapshot = await api('/api/daily-report', {
      method: 'POST',
      body: JSON.stringify(readForm())
    });
    state.snapshot = snapshot;
    fillForm(snapshot.report, snapshot.goal || {});
    renderDealHint(snapshot.dealLog);
    renderBoardFromForm();
    const history = await api('/api/history');
    renderHistory(history.rows || []);
    setStatus(`Saved ${snapshot.date}. ${qty.format(snapshot.report.soldDeals)} sold · GPU ${gpu(snapshot.report.totalGross, snapshot.report.soldDeals)} · ${qty.format(snapshot.report.deliveries)} delivered.`);
    setTab('board');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('addDeal').addEventListener('click', async () => {
  try {
    await api('/api/working-deals', {
      method: 'POST',
      body: JSON.stringify({
        date: $('reportDate').value,
        customer: $('dealCustomer').value,
        account: $('dealAccount').value,
        stock: $('dealStock').value,
        vehicle: $('dealVehicle').value,
        units: Number($('dealUnits').value || 1),
        frontGross: Number($('dealFront').value || 0),
        financeGross: Number($('dealFinance').value || 0),
        expectedDelivery: $('dealExpected').value,
        notes: $('dealNotes').value
      })
    });
    $('dealCustomer').value = '';
    $('dealAccount').value = '';
    $('dealStock').value = '';
    $('dealVehicle').value = '';
    $('dealUnits').value = '1';
    $('dealFront').value = '';
    $('dealFinance').value = '';
    $('dealExpected').value = '';
    $('dealNotes').value = '';
    await loadWorking();
    const snapshot = await loadDay($('reportDate').value);
    setStatus('Working deal added to the pipeline.', false, 'dealStatus');
    fillStatus(snapshot);
  } catch (error) {
    setStatus(error.message, true, 'dealStatus');
  }
});

$('dealTable').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  try {
    await api(`/api/working-deals/${encodeURIComponent(button.dataset.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: button.dataset.action })
    });
    await loadWorking();
    await loadDay($('reportDate').value);
    setStatus(`Deal marked ${button.dataset.action}.`, false, 'dealStatus');
  } catch (error) {
    setStatus(error.message, true, 'dealStatus');
  }
});

$('lastDealDayBtn').addEventListener('click', async () => {
  const last = state.lastFleetDate;
  if (!last) {
    setStatus('DEALINPUT scan did not find a fleet date.', true);
    return;
  }
  $('reportDate').value = last;
  try {
    const snapshot = await loadDay(last);
    fillStatus(snapshot);
  } catch (error) {
    setStatus(error.message, true);
  }
});

api('/api/config')
  .then((cfg) => fillCustomers(cfg.customers || []))
  .catch(() => {});

const requestedDate = new URLSearchParams(window.location.search).get('date');
$('reportDate').value = requestedDate || todayInputValue();
Promise.all([loadWorking(), loadDay($('reportDate').value)])
  .then(([, snapshot]) => fillStatus(snapshot))
  .catch((error) => setStatus(error.message, true));
