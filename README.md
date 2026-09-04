# Fleet Manager Report

Reporting tool for the Geaux Chevrolet fleet department. Leadership gets one briefing: working deals, sold deals, gross per unit, monthly goal, MTD front / finance / total gross, daily deliveries, courtesy deliveries, and total expected deliveries.

## What it tracks

- Working deals on a live pipeline board
- Sold deals (units)
- Gross per unit (total gross ÷ sold)
- Monthly unit and gross goal, with pace
- MTD front gross
- Finance gross (daily and MTD)
- Total gross (front + finance)
- Daily deliveries
- Daily courtesy deliveries
- Total expected deliveries (typed, or from working-deal expected dates)

## Three ways to use it

1. **Standalone web app** — deploy `apps-script-web/` as a link. The fleet manager never opens the sales log. Save and recall still write `FLM_*` tabs in GEAUXCHEVROLETSALESLOG. See `apps-script-web/INSTALL.md`.
2. **In the live workbook** — paste `apps-script/` into Extensions → Apps Script. It only creates `FLM_*` tabs and `FLM_*` functions. Never paste `FLM_Web.gs` there.
3. **This local Node app** — run on your computer to preview the same briefing. It saves to a local JSON file, not the Google Sheet.

The live workbook is GEAUXCHEVROLETSALESLOG:

https://docs.google.com/spreadsheets/d/1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w/edit

Inventory of its tabs is in `docs/GEAUXCHEVROLETSALESLOG.md`. Install rules are in `apps-script/INSTALL.md`.

## Local setup

```bash
npm install
npm test
npm start
```

Open http://localhost:3000

## Daily flow

1. Open the briefing and set the report date.
2. Fleet sold units and front / finance / total gross fill from `DEALINPUT` when TYPE or DEPT is Fleet or Commercial.
3. Override any pulled total if a deal is still being logged. Use **Refresh from deal log** if deals were added after the date was already selected.
4. Type working deals, daily deliveries, courtesy deliveries, and expected deliveries.
5. Set the monthly unit and gross goal once.
6. Log pipeline deals on **Working deals**. Mark them Sold, then Deliver.
7. Save. The same date can be recalled tomorrow.

## Project layout

- `src/reporting.js` — date, fleet-deal, GPU, goal, delivery, and compatibility rules
- `src/store.js` — JSON store used by the local app
- `public/` — briefing UI
- `apps-script/` — copy-safe Google Apps Script package for the live workbook (no `doGet`)
- `apps-script-web/` — standalone `doGet` web app that opens that workbook by ID
- `test/` — unit and API tests
