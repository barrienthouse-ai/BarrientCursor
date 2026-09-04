const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const state = {
  roster: [],
  advisors: ['Cody Raffary'],
  snapshot: null,
  weekMode: 'sold'
};

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

function setTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('.tab-page').forEach((page) => {
    page.classList.toggle('hidden', page.id !== name);
  });
}

function heatPill(value) {
  return `<span class="pill ${value}">${value}</span>`;
}

function renderHoursRows(rows) {
  const host = $('techHourRows');
  host.innerHTML = '';
  const list = rows.length ? rows : state.roster.map((techName) => ({ techName, clockHours: 8, soldHours: '', notes: '' }));
  for (const row of list) {
    host.appendChild(techRow(row));
  }
}

function techRow(row = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'row five tech-row';
  wrap.innerHTML = `
    <div>
      <div class="label">Tech</div>
      <span class="tech-name-label">${escapeAttr(row.techName || '')}</span>
      <input class="tech-name" type="hidden" value="${escapeAttr(row.techName || '')}" />
    </div>
    <label>Clock today <input class="tech-clock" type="number" step="0.1" value="${row.clockHours ?? 8}" /></label>
    <label>Sold today <input class="tech-sold" type="number" step="0.1" value="${row.soldHours ?? ''}" /></label>
    <div>
      <div class="label">${state.weekMode === 'payroll' ? 'Week payroll' : 'Week sold'}</div>
      <div class="week-hours" data-tech="${escapeAttr(row.techName || '')}">—</div>
    </div>
  `;
  wrap.querySelectorAll('input').forEach((input) => input.addEventListener('input', liveTotals));
  return wrap;
}

function readTechRows() {
  return [...document.querySelectorAll('.tech-row')].map((row) => ({
    techName: row.querySelector('.tech-name').value,
    clockHours: row.querySelector('.tech-clock').value,
    soldHours: row.querySelector('.tech-sold').value
  }));
}

function roundHours(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function applyProduction({ soldHours, clockHours, laborGross, closedCount }) {
  const sold = roundHours(soldHours);
  const clock = roundHours(clockHours);
  const labor = Number(laborGross) || 0;
  const closed = Number(closedCount) || 0;
  const unapplied = roundHours(clock - sold);
  if ($('prodSold')) {
    $('prodSold').textContent = qty.format(sold);
    $('prodElr').textContent = sold > 0 ? moneyExact.format(labor / sold) : '—';
    $('prodHoursRo').textContent = closed > 0 ? qty.format(sold / closed) : '—';
    $('prodUnapplied').textContent = qty.format(unapplied);
  }
  if ($('kpiHours')) {
    $('kpiHours').textContent = `${qty.format(sold)} / ${qty.format(clock)}`;
  }
}

function applyStoreRos() {
  if (!$('roOpen')) {
    return;
  }
  const open = Number($('openRos')?.value || 0);
  const opened = Number($('openedRos')?.value || 0);
  const closed = Number($('closedRos')?.value || 0);
  const saved = state.snapshot?.repairOrders || {};
  const savedOpened = Number(saved.openedCount ?? saved.writtenCount || 0);
  const savedClosed = Number(saved.closedCount || 0);
  const month = saved.monthly || { openedCount: savedOpened, closedCount: savedClosed };
  const mtdOpened = Math.max(0, Number(month.openedCount || 0) - savedOpened + opened);
  const mtdClosed = Math.max(0, Number(month.closedCount || 0) - savedClosed + closed);
  $('roOpen').textContent = String(open);
  $('roOpened').textContent = String(opened);
  $('roClosed').textContent = String(closed);
  if ($('roOpenedMtd')) {
    $('roOpenedMtd').textContent = `MTD opened ${mtdOpened}`;
    $('roClosedMtd').textContent = `MTD closed ${mtdClosed}`;
    $('roMtd').textContent = `${mtdOpened} / ${mtdClosed}`;
  }
}

function liveTotals() {
  const rows = readTechRows();
  let clock = 0;
  let sold = 0;
  for (const row of rows) {
    clock += Number(row.clockHours) || 0;
    sold += Number(row.soldHours) || 0;
  }
  const labor = Number($('laborGross')?.value || 0);
  const other = Number($('otherGross')?.value || 0);
  const closed = Number($('closedRos')?.value || 0);
  applyProduction({ soldHours: sold, clockHours: clock, laborGross: labor, closedCount: closed });
  applyStoreRos();
  if ($('kpiGross')) {
    const mtd = state.snapshot?.gross?.monthly?.totalGross || 0;
    $('kpiGross').textContent = money.format(labor + other);
    if ($('kpiGrossMonth')) {
      $('kpiGrossMonth').textContent = `MTD ${money.format(mtd)}`;
    }
  }
  applyWeekView();
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

function renderBriefing(snapshot) {
  $('kpiHours').textContent = `${qty.format(snapshot.techHours.soldHours)} / ${qty.format(snapshot.techHours.clockHours)}`;
  $('kpiEfficiency').textContent = `Efficiency ${pct(snapshot.techHours.efficiency)} · ${snapshot.techHours.lineCount} tech lines`;
  $('kpiGross').textContent = money.format(snapshot.gross.daily.totalGross);
  $('kpiGrossMonth').textContent = `MTD ${money.format(snapshot.gross.monthly.totalGross)} (${snapshot.gross.monthly.source === 'override' ? 'monthly override' : 'sum of dailies'})`;
  applyWeekView();
  $('kpiHeat').textContent = String(snapshot.heatCases.openCount);
  $('kpiHeatNote').textContent = `${snapshot.heatCases.awaitingBriefing} need briefing · ${snapshot.heatCases.resolvedTodayCount} resolved this day`;
  $('kpiHeatCard').classList.toggle('critical', snapshot.heatCases.criticalCount > 0);

  const production = snapshot.production || {};
  applyProduction({
    soldHours: production.soldHours ?? snapshot.techHours.soldHours,
    clockHours: production.clockHours ?? snapshot.techHours.clockHours,
    laborGross: production.laborGross ?? snapshot.gross.daily.laborGross,
    closedCount: production.closedCount ?? snapshot.repairOrders.closedCount
  });

  $('hoursTable').innerHTML = snapshot.techHours.rows.map((row) => {
    const eff = row.clockHours ? row.soldHours / row.clockHours : null;
    const unapplied = roundHours((Number(row.clockHours) || 0) - (Number(row.soldHours) || 0));
    return `<tr><td>${escapeAttr(row.techName)}</td><td>${qty.format(row.clockHours)}</td><td>${qty.format(row.soldHours)}</td><td>${qty.format(unapplied)}</td><td>${pct(eff)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">No hours reported for this date.</td></tr>';

  $('openHeatList').innerHTML = snapshot.heatCases.open.length
    ? snapshot.heatCases.open.map((item) => (
      `<p><strong>${escapeAttr(item.customer || 'No customer name')}</strong> ${heatPill(item.severity)} ${heatPill(item.status)}<br>${escapeAttr(item.advisor || item.owner || 'Advisor n/a')} · ${escapeAttr(item.technician || 'Tech n/a')} · ${escapeAttr(item.roNumber || 'RO n/a')}<br>${escapeAttr(item.issue)}</p>`
    )).join('')
    : '<p class="meta">No open heat cases.</p>';

  $('resolvedHeatList').innerHTML = snapshot.heatCases.resolvedToday.length
    ? snapshot.heatCases.resolvedToday.map((item) => (
      `<p><strong>${escapeAttr(item.customer || item.id)}</strong> resolved ${escapeAttr(item.resolvedAt || '')}<br>${escapeAttr(item.advisor || item.owner || '')}${item.technician ? ` · ${escapeAttr(item.technician)}` : ''}<br>${escapeAttr(item.resolutionNotes || 'No resolution notes')}</p>`
    )).join('')
    : '<p class="meta">No heat cases were marked resolved on this date.</p>';
}

function currentWeek() {
  const weeks = state.snapshot && state.snapshot.weekHours ? state.snapshot.weekHours : {};
  return weeks[state.weekMode] || { rows: [], total: 0, start: '', end: '', label: state.weekMode === 'payroll' ? 'Payroll week (Tue–Mon)' : 'Sold week (Mon–Fri)' };
}

function setWeekMode(mode) {
  state.weekMode = mode === 'payroll' ? 'payroll' : 'sold';
  if ($('weekSoldBtn')) {
    $('weekSoldBtn').className = state.weekMode === 'sold' ? 'btn primary' : 'btn ghost';
    $('weekPayrollBtn').className = state.weekMode === 'payroll' ? 'btn primary' : 'btn ghost';
  }
  applyWeekView();
}

function applyWeekView() {
  const week = currentWeek();
  const byName = {};
  (week.rows || []).forEach((row) => {
    byName[String(row.techName || '').trim().toUpperCase()] = row.hours;
  });
  document.querySelectorAll('.week-hours').forEach((cell) => {
    const key = String(cell.getAttribute('data-tech') || '').trim().toUpperCase();
    cell.textContent = byName[key] != null ? qty.format(byName[key]) : '0';
  });
  if ($('kpiWeekLabel')) {
    $('kpiWeekLabel').textContent = week.label || (state.weekMode === 'payroll' ? 'Payroll week (Tue–Mon)' : 'Sold week (Mon–Fri)');
    $('kpiWeek').textContent = week.total != null ? qty.format(week.total) : '—';
    $('kpiWeekNote').textContent = week.start && week.end ? `${week.start} to ${week.end}` : 'Save daily hours to build the week total.';
  }
  if ($('weekRangeLabel')) {
    $('weekRangeLabel').textContent = week.start && week.end
      ? `${week.label}: ${week.start} to ${week.end}`
      : 'Save daily hours to build the week total.';
  }
  if ($('weekSoldTotal') && state.snapshot && state.snapshot.weekHours) {
    $('weekSoldTotal').value = state.snapshot.weekHours.sold.total;
    $('weekPayrollTotal').value = state.snapshot.weekHours.payroll.total;
  }
}

function roField(value, reported) {
  if (!reported) {
    return '';
  }
  return value == null || value === '' ? '' : value;
}

function fillDailyForm(snapshot) {
  renderHoursRows(snapshot.techHours.formRows || snapshot.techHours.rows);
  const daily = snapshot.gross.daily;
  $('laborGross').value = daily.laborGross || '';
  $('otherGross').value = daily.otherGross || '';
  const ros = snapshot.repairOrders || {};
  $('openRos').value = roField(ros.openCount, ros.reported);
  $('openedRos').value = roField(ros.openedCount ?? ros.writtenCount, ros.reported);
  $('closedRos').value = roField(snapshot.production?.closedCount ?? ros.closedCount, ros.reported);
  $('grossNotes').value = '';
  $('grossPeriod').value = 'daily';
  liveTotals();
}

async function loadDay() {
  const date = $('reportDate').value;
  const snapshot = await api(`/api/summary?date=${encodeURIComponent(date)}`);
  state.snapshot = snapshot;
  renderBriefing(snapshot);
  fillDailyForm(snapshot);
  applyWeekView();
  return snapshot;
}

async function loadHistory() {
  const hours = await api('/api/tech-hours');
  const gross = await api('/api/gross?period=daily');
  const ros = await api('/api/repair-orders');
  $('historyHours').innerHTML = hours.rows.map((row) => (
    `<tr><td>${row.date}</td><td>${escapeAttr(row.techName)}</td><td>${qty.format(row.clockHours)}</td><td>${qty.format(row.soldHours)}</td></tr>`
  )).join('');
  const byDate = new Map();
  for (const row of gross.rows) {
    byDate.set(row.date, { date: row.date, gross: (row.laborGross || 0) + (row.otherGross || 0), open: '—', closed: '—', written: '—' });
  }
  for (const row of ros.rows) {
    const current = byDate.get(row.date) || { date: row.date, gross: 0, open: 0, closed: 0, written: 0 };
    current.open = row.openCount;
    current.closed = row.closedCount;
    current.written = row.writtenCount;
    byDate.set(row.date, current);
  }
  $('historyOps').innerHTML = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => (
    `<tr><td>${row.date}</td><td>${money.format(row.gross)}</td><td>${row.open}</td><td>${row.closed}</td><td>${row.written}</td></tr>`
  )).join('');
}

async function loadHeatBoard() {
  const { rows } = await api('/api/heat-cases');
  $('heatTable').innerHTML = rows.sort((a, b) => b.openedDate.localeCompare(a.openedDate)).map((item) => `
    <tr>
      <td><strong>${escapeAttr(item.customer || 'No customer name')}</strong><br><span class="meta">${escapeAttr(item.id)}${item.roNumber ? ` · ${escapeAttr(item.roNumber)}` : ''}</span></td>
      <td>${escapeAttr(item.advisor || item.owner || '—')}</td>
      <td>${escapeAttr(item.technician || '—')}</td>
      <td>${escapeAttr(item.issue)}</td>
      <td>${heatPill(item.severity)}</td>
      <td>${heatPill(item.status)}</td>
      <td>${item.resolvedAt ? escapeAttr(item.resolvedAt) : '—'}${item.resolutionNotes ? `<br>${escapeAttr(item.resolutionNotes)}` : ''}</td>
      <td>
        ${item.status !== 'resolved' ? `<button class="btn warn" data-action="brief" data-id="${item.id}" type="button">Briefed</button>
        <button class="btn ok" data-action="resolve" data-id="${item.id}" type="button">Resolve</button>` : `<button class="btn ghost" data-action="reopen" data-id="${item.id}" type="button">Reopen</button>`}
      </td>
    </tr>
  `).join('');
}

function fillHeatLookups() {
  const tech = $('heatTechnician');
  const current = tech.value;
  tech.innerHTML = '<option value="">Select technician</option>' + state.roster.map((name) => (
    `<option value="${escapeAttr(name)}">${escapeAttr(name)}</option>`
  )).join('');
  if (current) {
    tech.value = current;
  }
  $('advisorList').innerHTML = state.advisors.map((name) => (
    `<option value="${escapeAttr(name)}"></option>`
  )).join('');
}

async function init() {
  $('reportDate').value = todayInputValue();
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.addEventListener('click', async () => {
      setTab(button.dataset.tab);
      if (button.dataset.tab === 'history') {
        await loadHistory();
      }
      if (button.dataset.tab === 'heat') {
        await loadHeatBoard();
      }
    });
  });

  const config = await api('/api/config');
  state.roster = config.roster;
  state.advisors = config.advisors || state.advisors;
  fillHeatLookups();
  await loadDay();
  await loadHeatBoard();

  if ($('weekSoldBtn')) {
    $('weekSoldBtn').addEventListener('click', () => setWeekMode('sold'));
    $('weekPayrollBtn').addEventListener('click', () => setWeekMode('payroll'));
  }
  $('recallBtn').addEventListener('click', async () => {
    await loadDay();
    setTab('daily');
    $('dailyStatus').textContent = `Recalled ${$('reportDate').value}.`;
  });
  $('reportDate').addEventListener('change', loadDay);
  ['laborGross', 'otherGross', 'openRos', 'openedRos', 'closedRos'].forEach((id) => {
    $(id).addEventListener('input', liveTotals);
  });

  $('saveDaily').addEventListener('click', async () => {
    $('dailyStatus').textContent = 'Saving…';
    try {
      const date = $('reportDate').value;
      await api('/api/daily-report', {
        method: 'POST',
        body: JSON.stringify({
          date,
          techHours: { rows: readTechRows() },
          repairOrders: {
            openCount: $('openRos').value,
            openedCount: $('openedRos').value,
            writtenCount: $('openedRos').value,
            closedCount: $('closedRos').value
          },
          gross: {
            period: $('grossPeriod').value,
            laborGross: $('laborGross').value,
            otherGross: $('otherGross').value,
            notes: $('grossNotes').value
          }
        })
      });
      await loadDay();
      $('dailyStatus').textContent = `Saved report for ${date}.`;
    } catch (error) {
      $('dailyStatus').textContent = error.message;
      $('dailyStatus').className = 'error';
    }
  });

  $('addHeat').addEventListener('click', async () => {
    $('heatStatus').textContent = 'Saving…';
    try {
      await api('/api/heat-cases', {
        method: 'POST',
        body: JSON.stringify({
          openedDate: $('reportDate').value,
          customer: $('heatCustomer').value,
          advisor: $('heatAdvisor').value,
          technician: $('heatTechnician').value,
          roNumber: $('heatRo').value,
          vehicle: $('heatVehicle').value,
          issue: $('heatIssue').value,
          severity: $('heatSeverity').value
        })
      });
      $('heatCustomer').value = '';
      $('heatRo').value = '';
      $('heatVehicle').value = '';
      $('heatIssue').value = '';
      await loadHeatBoard();
      await loadDay();
      $('heatStatus').textContent = 'Heat case added.';
    } catch (error) {
      $('heatStatus').textContent = error.message;
      $('heatStatus').className = 'error';
    }
  });

  $('heatTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    let notes = '';
    if (button.dataset.action === 'resolve') {
      notes = window.prompt('Resolution notes (shown on the briefing when this case is closed):', '') || '';
    }
    await api(`/api/heat-cases/${encodeURIComponent(button.dataset.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: button.dataset.action, notes })
    });
    await loadHeatBoard();
    await loadDay();
  });
}

init().catch((error) => {
  $('dailyStatus').textContent = error.message;
});
