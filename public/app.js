const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const state = { snapshot: null };

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

function num(id) {
  const value = $(id).value;
  return value === '' ? 0 : Number(value);
}

function liveTotals() {
  const newSold = num('newSold');
  const usedSold = num('usedSold');
  const front = num('frontGross');
  const back = num('backGross');
  $('totalSold').value = String(newSold + usedSold);
  $('totalGross').value = (Math.round((front + back) * 100) / 100).toFixed(2);
  const appts = num('appointments');
  const shown = num('shownAppointments');
  const visits = num('showroomVisits');
  $('kpiUnits').textContent = `${qty.format(newSold)} / ${qty.format(usedSold)}`;
  $('kpiGross').textContent = money.format(front + back);
  $('kpiRates').textContent = `${pct(appts ? shown / appts : null)} / ${pct(visits ? (newSold + usedSold) / visits : null)}`;
  $('kpiNext').textContent = qty.format(num('nextDayAppointments'));
  renderMtdStrip();
}

function renderMtdStrip() {
  if (!$('mtdNew')) {
    return;
  }
  const prior = state.snapshot?.monthlyPrior || {};
  const mtdNew = (Number(prior.newSold) || 0) + num('newSold');
  const mtdUsed = (Number(prior.usedSold) || 0) + num('usedSold');
  const mtdGross = (Number(prior.totalGross) || 0) + num('frontGross') + num('backGross');
  const mtdAppts = (Number(prior.appointments) || 0) + num('appointments');
  const mtdShown = (Number(prior.shownAppointments) || 0) + num('shownAppointments');
  const mtdVisits = (Number(prior.showroomVisits) || 0) + num('showroomVisits');
  $('mtdNew').textContent = qty.format(mtdNew);
  $('mtdUsed').textContent = qty.format(mtdUsed);
  $('mtdGross').textContent = money.format(mtdGross);
  $('mtdAppts').textContent = qty.format(mtdAppts);
  $('mtdShown').textContent = qty.format(mtdShown);
  $('mtdVisits').textContent = qty.format(mtdVisits);
  $('mtdShowPct').textContent = pct(mtdAppts ? mtdShown / mtdAppts : null);
  $('mtdClosePct').textContent = pct(mtdVisits ? (mtdNew + mtdUsed) / mtdVisits : null);
}

function fillForm(report = {}) {
  $('newSold').value = report.newSold ?? '';
  $('usedSold').value = report.usedSold ?? '';
  $('frontGross').value = report.frontGross ?? '';
  $('backGross').value = report.backGross ?? '';
  $('appointments').value = report.appointments ?? '';
  $('shownAppointments').value = report.shownAppointments ?? '';
  $('showroomVisits').value = report.showroomVisits ?? '';
  $('nextDayAppointments').value = report.nextDayAppointments ?? '';
  $('notes').value = report.notes || '';
  liveTotals();
}

function readForm() {
  return {
    date: $('reportDate').value,
    newSold: num('newSold'),
    usedSold: num('usedSold'),
    frontGross: num('frontGross'),
    backGross: num('backGross'),
    appointments: num('appointments'),
    shownAppointments: num('shownAppointments'),
    showroomVisits: num('showroomVisits'),
    nextDayAppointments: num('nextDayAppointments'),
    notes: $('notes').value
  };
}

function renderDealHint(dealLog) {
  const last = dealLog?.lastRetailDate || '';
  state.lastRetailDate = last;
  $('lastDealNote').textContent = last
    ? `Last retail day in DEALINPUT: ${last}`
    : 'Last retail day in DEALINPUT: (none found)';
  if (!dealLog || !dealLog.daily) {
    $('dealHint').textContent = 'Deal log: —';
    return;
  }
  const daily = dealLog.daily;
  $('dealHint').textContent = `Deal log: ${daily.newSold} new / ${daily.usedSold} used · ${money.format(daily.frontGross)} front · ${money.format(daily.backGross)} back · ${money.format(daily.totalGross)} total`;
}

function renderRecap(snapshot) {
  const report = snapshot.report || {};
  const monthly = snapshot.monthly || {};
  const weekly = snapshot.weekly || {};
  $('kpiUnits').textContent = `${qty.format(report.newSold || 0)} / ${qty.format(report.usedSold || 0)}`;
  $('kpiUnitsNote').textContent = snapshot.unitsSource === 'deal-log'
    ? `Filled from DEALINPUT · ${qty.format(report.totalSold || 0)} retail units`
    : snapshot.saved
      ? `Saved recap · ${qty.format(report.totalSold || 0)} retail units`
      : 'Not saved yet — numbers below are a draft';
  $('kpiGross').textContent = money.format(report.totalGross || 0);
  $('kpiGrossMonth').textContent = `Front ${money.format(report.frontGross || 0)} · Back ${money.format(report.backGross || 0)} · MTD ${money.format(monthly.totalGross || 0)}`;
  $('kpiRates').textContent = `${pct(snapshot.metrics?.showRate)} / ${pct(snapshot.metrics?.closeRate)}`;
  $('kpiRatesNote').textContent = `${qty.format(report.shownAppointments || 0)} shown of ${qty.format(report.appointments || 0)} appts · ${qty.format(report.showroomVisits || 0)} visits`;
  $('kpiNext').textContent = qty.format(report.nextDayAppointments || 0);
  $('kpiNextNote').textContent = `Set for ${snapshot.nextBusinessDate}`;
  $('nextDayLabel').textContent = `Next business day is ${snapshot.nextBusinessDate} (Sunday closed).`;

  const rows = [
    ['New sold', report.newSold, monthly.newSold, weekly.newSold],
    ['Used sold', report.usedSold, monthly.usedSold, weekly.usedSold],
    ['Total units', report.totalSold, monthly.totalSold, weekly.totalSold],
    ['Front gross', money.format(report.frontGross || 0), money.format(monthly.frontGross || 0), money.format(weekly.frontGross || 0)],
    ['Back gross', money.format(report.backGross || 0), money.format(monthly.backGross || 0), money.format(weekly.backGross || 0)],
    ['Total gross', money.format(report.totalGross || 0), money.format(monthly.totalGross || 0), money.format(weekly.totalGross || 0)],
    ['Appts', report.appointments, monthly.appointments, weekly.appointments],
    ['Appts shown', report.shownAppointments, monthly.shownAppointments, weekly.shownAppointments],
    ['Showroom visits', report.showroomVisits, monthly.showroomVisits, weekly.showroomVisits],
    ['Show %', pct(snapshot.metrics?.showRate), pct(monthly.metrics?.showRate), pct(weekly.metrics?.showRate)],
    ['Close %', pct(snapshot.metrics?.closeRate), pct(monthly.metrics?.closeRate), pct(weekly.metrics?.closeRate)]
  ];
  $('compareTable').innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? 0}</td>`).join('')}</tr>`).join('');

  $('trafficSummary').innerHTML = `
    <div class="stat"><div class="label">Appointments</div><div class="value">${qty.format(report.appointments || 0)}</div></div>
    <div class="stat"><div class="label">Shown</div><div class="value">${qty.format(report.shownAppointments || 0)}</div><div class="meta">Show rate ${pct(snapshot.metrics?.showRate)}</div></div>
    <div class="stat"><div class="label">Showroom visits</div><div class="value">${qty.format(report.showroomVisits || 0)}</div><div class="meta">Close rate ${pct(snapshot.metrics?.closeRate)}</div></div>
    <div class="stat"><div class="label">Next day appts</div><div class="value">${qty.format(report.nextDayAppointments || 0)}</div></div>
  `;
}

function renderHistory(rows) {
  if (!rows.length) {
    $('historyTable').innerHTML = '<tr><td colspan="10">No recaps saved yet.</td></tr>';
    return;
  }
  $('historyTable').innerHTML = [...rows].reverse().map((row) => `
    <tr>
      <td>${row.date}</td>
      <td>${row.newSold}</td>
      <td>${row.usedSold}</td>
      <td>${money.format(row.frontGross || 0)}</td>
      <td>${money.format(row.backGross || 0)}</td>
      <td>${money.format(row.totalGross || 0)}</td>
      <td>${row.appointments}</td>
      <td>${row.shownAppointments}</td>
      <td>${row.showroomVisits}</td>
      <td>${row.nextDayAppointments}</td>
    </tr>
  `).join('');
}

async function loadDay(date) {
  if (!date) {
    return null;
  }
  const snapshot = await api(`/api/summary?date=${encodeURIComponent(date)}`);
  state.snapshot = snapshot;
  fillForm(snapshot.report);
  renderDealHint(snapshot.dealLog);
  renderRecap(snapshot);
  const history = await api('/api/history');
  renderHistory(history.rows || []);
  return snapshot;
}

function fillStatus(snapshot) {
  const date = snapshot?.date || $('reportDate').value;
  const deals = snapshot?.dealLog?.daily?.dealCount || 0;
  const last = snapshot?.dealLog?.lastRetailDate;
  if (deals) {
    setStatus(`Filled ${deals} retail deal${deals === 1 ? '' : 's'} from DEALINPUT on ${date}. Enter traffic and save.`);
    return;
  }
  const lastNote = last ? ` Last retail day in DEALINPUT is ${last}.` : '';
  setStatus(snapshot?.saved
    ? `No retail deals in DEALINPUT on ${date}. Showing the saved recap.${lastNote}`
    : `No retail deals in DEALINPUT on ${date}.${lastNote} Enter units, gross, and traffic.`);
}

function setStatus(message, isError = false) {
  const el = $('dailyStatus');
  el.textContent = message;
  el.className = isError ? 'notice error' : 'notice';
}

document.querySelectorAll('.tabs button').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});

['newSold', 'usedSold', 'frontGross', 'backGross', 'appointments', 'shownAppointments', 'showroomVisits', 'nextDayAppointments'].forEach((id) => {
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
    fillForm(filled.report);
    renderDealHint(filled.dealLog);
    setStatus('Units and gross refreshed from DEALINPUT. Traffic was kept. Save to lock the recap.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('saveDaily').addEventListener('click', async () => {
  try {
    const snapshot = await api('/api/daily-report', {
      method: 'POST',
      body: JSON.stringify(readForm())
    });
    state.snapshot = snapshot;
    fillForm(snapshot.report);
    renderDealHint(snapshot.dealLog);
    renderRecap(snapshot);
    const history = await api('/api/history');
    renderHistory(history.rows || []);
    setStatus(`Saved ${snapshot.date}. Total gross ${money.format(snapshot.report.totalGross)}.`);
    setTab('recap');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('emailReport').addEventListener('click', async () => {
  try {
    const payload = { ...readForm(), to: $('reportEmail').value };
    const result = await api('/api/email-report', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (result.html) {
      const blob = new Blob([result.html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
    if (result.sent) {
      setStatus(`Emailed ${result.to}.`);
      return;
    }
    setStatus(result.to
      ? `Preview opened for ${result.to}. In the live sheet this sends through Gmail.`
      : 'Preview opened. Add a report email when you are ready to send.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

api('/api/config')
  .then((cfg) => {
    if (cfg?.reportEmail) {
      $('reportEmail').value = cfg.reportEmail;
    }
  })
  .catch(() => {});

$('lastDealDayBtn').addEventListener('click', async () => {
  const last = state.lastRetailDate;
  if (!last) {
    setStatus('DEALINPUT scan did not find a retail date.', true);
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

const requestedDate = new URLSearchParams(window.location.search).get('date');
$('reportDate').value = requestedDate || todayInputValue();
loadDay($('reportDate').value)
  .then((snapshot) => fillStatus(snapshot))
  .catch((error) => setStatus(error.message, true));
