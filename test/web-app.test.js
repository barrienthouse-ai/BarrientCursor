import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('standalone web app', () => {
  it('keeps doGet out of the bound workbook package', () => {
    const dir = path.join(root, 'apps-script');
    const gsFiles = readdirSync(dir).filter((name) => name.endsWith('.gs'));
    assert.ok(gsFiles.length > 0);
    for (const name of gsFiles) {
      const source = read(path.join('apps-script', name));
      assert.doesNotMatch(source, /function doGet\s*\(/, name);
      assert.doesNotMatch(source, /function doPost\s*\(/, name);
    }
  });

  it('opens the live workbook by ID and serves the current briefing', () => {
    const web = read('apps-script-web/SMR_Web.gs');
    assert.match(web, /function doGet\s*\(/);
    assert.match(web, /SMR_WEB_WORKBOOK_ID = '1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w'/);
    assert.match(web, /SMR_briefingHtml_\(\)/);
    assert.match(web, /Never add it to GEAUXCHEVROLETSALESLOG/);
    assert.doesNotMatch(web, /SpreadsheetApp\.getUi\(\)/);

    const sheets = read('apps-script/SMR_Sheets.gs');
    assert.match(sheets, /SpreadsheetApp\.openById\(id\)/);
    assert.match(sheets, /SMR_workbookId_\(\)/);

    const menu = read('apps-script/SMR_Menu.gs');
    assert.match(menu, /function SMR_briefingHtml_/);
    assert.match(menu, /createTemplateFromFile\('SMR_App'\)/);

    const manifest = read('apps-script-web/appsscript.json');
    assert.match(manifest, /USER_DEPLOYING/);
    assert.match(manifest, /auth\/spreadsheets/);
  });
});
