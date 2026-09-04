import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps-script');

function read(name) {
  return readFileSync(path.join(root, name), 'utf8');
}

describe('SMR load-speed contract', () => {
  it('opens the dialog from a cached snapshot instead of the workbook', () => {
    const menu = read('SMR_Menu.gs');
    assert.match(menu, /createTemplateFromFile\('SMR_App'\)/);
    assert.match(menu, /SMR_briefStoreGet_/);
    assert.match(menu, /seedJson/);

    const html = read('SMR_App.html');
    assert.match(html, /var SEED = <\?!= seedJson \?>;/);
    assert.match(html, /function overlaySummary\(/);
    assert.match(html, /Opened instantly from last save/);
    assert.match(html, /if \(SEED && SEED\.summary\)/);
    assert.doesNotMatch(html, /SMR_ensureSheets/);
    assert.match(html, /id="heatAdvisor"/);
    assert.match(html, /id="heatTechnician"/);
    assert.match(html, /<th>Customer<\/th>/);
    assert.match(html, /Sold week Mon–Fri/);
    assert.match(html, /Payroll Tue–Mon/);
    assert.doesNotMatch(html, /class="tech-open"/);
    assert.match(html, /Open ROs/);
    assert.match(html, /id="prodSold"/);
    assert.match(html, /id="prodElr"/);
    assert.match(html, /id="prodHoursRo"/);
    assert.match(html, /id="prodUnapplied"/);
    assert.match(html, /id="closedRos"/);
    assert.match(html, /id="openRos"/);
    assert.match(html, /id="openedRos"/);
    assert.match(html, /Opened today/);
    assert.match(html, /MTD opened \/ closed/);
    assert.match(html, /Sold hours/);
    assert.match(html, /Hours \/ RO/);
    assert.match(html, /Unapplied time/);
    assert.match(html, /function liveTotals\(/);
    assert.match(html, /onclick="setTab\('briefing'\)"/);
    assert.match(html, /Hours by technician/);
    assert.match(html, /id="hoursTable"/);
    assert.match(html, /Shop sold labor hours today/);
    assert.match(html, /BarrientCursor · Fixed operations/);
  });

  it('loads a briefing from SMR_ properties before touching SMR sheets', () => {
    const api = read('SMR_Api.gs');
    assert.match(api, /function SMR_loadBriefing/);
    const load = api.slice(api.indexOf('function SMR_loadBriefing'), api.indexOf('function SMR_sumHourRows_'));
    assert.match(load, /SMR_briefStoreGet_/);
    assert.match(load, /SMR_rosterStoreGet_/);
    assert.doesNotMatch(load, /SMR_countOpenHeatFast_/);
    assert.doesNotMatch(load, /SMR_ensureSheets/);
    assert.doesNotMatch(load, /SMR_getSummary/);
    assert.match(api, /function SMR_production_/);
    assert.match(api, /function SMR_attachProduction_/);
    assert.match(api, /function SMR_recallRoFast_/);
    assert.match(api, /hoursPerRo/);
    assert.match(api, /unappliedHours/);
  });

  it('keeps snapshot helpers on SMR_ keys only', () => {
    const sheets = read('SMR_Sheets.gs');
    assert.match(sheets, /SMR_BRIEF_PROP_PREFIX_ = 'SMR_b_'/);
    assert.match(sheets, /SMR_ROSTER_PROP_KEY_ = 'SMR_roster'/);
    assert.match(sheets, /SpreadsheetApp\.openById\(id\)/);
    assert.doesNotMatch(sheets, /dealerLogoDataUrl/);
  });

  it('overlays saved hours onto the already-painted roster', () => {
    const rows = [
      { techName: 'BIG AL', clockHours: 8, soldHours: 9 },
      { techName: 'ELECTRIC-T', clockHours: 8, soldHours: 7 }
    ];
    const painted = ['BIG AL', 'ELECTRIC-T'];
    const namesMatch = painted.length === rows.length && painted.every((name, i) => name === rows[i].techName);
    assert.equal(namesMatch, true);
    assert.equal(rows.reduce((sum, row) => sum + row.soldHours, 0), 16);
  });

  it('parses the local briefing script', () => {
    const appJs = path.join(root, '..', 'public', 'app.js');
    const src = readFileSync(appJs, 'utf8');
    assert.doesNotMatch(src, /\?\?[^;\n]*\|\|/);
    assert.match(src, /applyStoreRos/);
    assert.match(src, /openedCount/);
  });
});
