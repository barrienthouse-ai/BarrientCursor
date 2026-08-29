# Service Manager Report

Reporting tool for the service manager to send daily numbers up to leadership, without touching the other tools already living in the shop Google Sheet.

## What it tracks

- Daily technician clock and sold hours, with recall of any previously saved day
- Service department gross, daily or as a monthly override / month-to-date rollup
- Open ROs, ROs written, and ROs closed that day
- Heat cases that need a briefing, including who owns them and when they were resolved

## Two ways to use it

1. **This web app** — run locally to enter and review the same briefing.
2. **Google Apps Script** in `apps-script/` — paste into the existing workbook. It only creates `SMR_*` tabs and `SMR_*` functions, so current menus, triggers, and sheets stay intact.

The live workbook is:

https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit

It is not publicly readable, so this environment could not inventory the current Apps Script project. Isolation rules are documented in `apps-script/INSTALL.md`.

## Local setup

```bash
npm install
npm test
npm start
```

Open http://localhost:3000

## Project layout

- `src/reporting.js` — date, hour, gross, heat-case, and compatibility rules
- `src/store.js` — JSON store used by the local app
- `public/` — briefing UI
- `apps-script/` — copy-safe Google Apps Script package
- `test/` — unit and API tests
