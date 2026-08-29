const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const state = {
  roster: [],
  snapshot: null
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
  if (!list.length) {
    list.push({ techName: '', clockHours: 8, soldHours: '', notes: '' });
  }
  for (const row of list) {
    host.appendChild(techRow(row));
  }
}

function techRow(row = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'row five tech-row';
  wrap.innerHTML = `
    <label>Tech <input class="tech-name" value="${escapeAttr(row.techName || '')}" /></label>
    <label>Clock <input class="tech-clock" type="number" step="0.1" value="${row.clockHours ?? ''}" /></label>
    <label>Sold <input class="tech-sold" type="number" step="0.1" value="${row.soldHours ?? ''}" /></label>
    <label>Notes <input class="tech-notes" value="${escapeAttr(row.notes || '')}" /></label>
    <button class="btn ghost remove-row" type="button">Remove</button>
  `;
  wrap.querySelector('.remove-row').addEventListener('click', () => wrap.remove());
  return wrap;
}

function readTechRows() {
  return [...document.querySelectorAll('.tech-row')].map((row) => ({
    techName: row.querySelector('.tech-name').value,
    clockHours: row.querySelector('.tech-clock').value,
    soldHours: row.querySelector('.tech-sold').value,
    notes: row.querySelector('.tech-notes').value
  }));
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
  $('kpiRos').textContent = snapshot.repairOrders.reported
    ? `${snapshot.repairOrders.openCount} / ${snapshot.repairOrders.closedCount} / ${snapshot.repairOrders.writtenCount}`
    : '—';
  $('kpiRoNote').textContent = snapshot.repairOrders.reported ? 'Open / closed today / written today' : 'No RO report saved for this date';
  $('kpiHeat').textContent = String(snapshot.heatCases.openCount);
  $('kpiHeatNote').textContent = `${snapshot.heatCases.awaitingBriefing} need briefing · ${snapshot.heatCases.resolvedTodayCount} resolved this day`;
  $('kpiHeatCard').classList.toggle('critical', snapshot.heatCases.criticalCount > 0);

  $('hoursTable').innerHTML = snapshot.techHours.rows.map((row) => {
    const eff = row.clockHours ? row.soldHours / row.clockHours : null;
    return `<tr><td>${escapeAttr(row.techName)}</td><td>${qty.format(row.clockHours)}</td><td>${qty.format(row.soldHours)}</td><td>${pct(eff)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No hours reported for this date.</td></tr>';

  $('openHeatList').innerHTML = snapshot.heatCases.open.length
    ? snapshot.heatCases.open.map((item) => (
      `<p><strong>${escapeAttr(item.id)}</strong> ${heatPill(item.severity)} ${heatPill(item.status)}<br>${escapeAttr(item.customer || 'Customer n/a')} · ${escapeAttr(item.roNumber || 'RO n/a')}<br>${escapeAttr(item.issue)}</p>`
    )).join('')
    : '<p class="meta">No open heat cases.</p>';

  $('resolvedHeatList').innerHTML = snapshot.heatCases.resolvedToday.length
    ? snapshot.heatCases.resolvedToday.map((item) => (
      `<p><strong>${escapeAttr(item.id)}</strong> resolved ${escapeAttr(item.resolvedAt || '')}<br>${escapeAttr(item.resolutionNotes || 'No resolution notes')}</p>`
    )).join('')
    : '<p class="meta">No heat cases were marked resolved on this date.</p>';
}

function fillDailyForm(snapshot) {
  renderHoursRows(snapshot.techHours.rows);
  const daily = snapshot.gross.daily;
  $('laborGross').value = daily.laborGross || '';
  $('partsGross').value = daily.partsGross || '';
  $('otherGross').value = daily.otherGross || '';
  $('grossNotes').value = '';
  $('grossPeriod').value = 'daily';
  $('openCount').value = snapshot.repairOrders.reported ? snapshot.repairOrders.openCount : '';
  $('closedCount').value = snapshot.repairOrders.reported ? snapshot.repairOrders.closedCount : '';
  $('writtenCount').value = snapshot.repairOrders.reported ? snapshot.repairOrders.writtenCount : '';
  $('roNotes').value = snapshot.repairOrders.row?.notes || '';
}

async function loadDay() {
  const date = $('reportDate').value;
  const snapshot = await api(`/api/summary?date=${encodeURIComponent(date)}`);
  state.snapshot = snapshot;
  renderBriefing(snapshot);
  fillDailyForm(snapshot);
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
    byDate.set(row.date, { date: row.date, gross: row.laborGross + row.partsGross + row.otherGross, open: '—', closed: '—', written: '—' });
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
      <td>${escapeAttr(item.id)}</td>
      <td>${escapeAttr(item.openedDate)}</td>
      <td>${escapeAttr(item.customer || '—')}<br>${escapeAttr(item.roNumber || '')}</td>
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
  await loadDay();
  await loadHeatBoard();

  $('recallBtn').addEventListener('click', async () => {
    await loadDay();
    setTab('daily');
    $('dailyStatus').textContent = `Recalled ${$('reportDate').value}.`;
  });
  $('reportDate').addEventListener('change', loadDay);
  $('addTechRow').addEventListener('click', () => $('techHourRows').appendChild(techRow()));

  $('saveDaily').addEventListener('click', async () => {
    $('dailyStatus').textContent = 'Saving…';
    try {
      const date = $('reportDate').value;
      await api('/api/daily-report', {
        method: 'POST',
        body: JSON.stringify({
          date,
          techHours: { rows: readTechRows() },
          gross: {
            period: $('grossPeriod').value,
            laborGross: $('laborGross').value,
            partsGross: $('partsGross').value,
            otherGross: $('otherGross').value,
            notes: $('grossNotes').value
          },
          repairOrders: {
            openCount: $('openCount').value,
            closedCount: $('closedCount').value,
            writtenCount: $('writtenCount').value,
            notes: $('roNotes').value
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
          roNumber: $('heatRo').value,
          vehicle: $('heatVehicle').value,
          issue: $('heatIssue').value,
          severity: $('heatSeverity').value,
          owner: $('heatOwner').value
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
