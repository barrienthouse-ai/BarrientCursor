# Sales Manager Report

End-of-day reporting tool for Geaux Chevrolet sales managers. Leadership gets one recap: retail units, front/back/total gross, and the traffic numbers that are not in the deal log.

## What it tracks

- New cars sold
- Used cars sold
- Front gross
- Back gross
- Total gross (front + back)
- Appointments for the day
- Shown appointments
- Total showroom visits
- Appointments for the next business day

Show rate, close rate, and month-to-date totals are calculated from those entries. Next business day skips Sunday.

## Two ways to use it

1. **This web app** — run locally to enter and review the same recap.
2. **Google Apps Script** in `apps-script/` — paste into GEAUXCHEVROLETSALESLOG. It only creates `SLM_*` tabs and `SLM_*` functions, so current menus, triggers, `DEALINPUT`, `SUMMARY`, and any `SMR_*` service tabs stay intact.

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

1. Open the recap at close and set the report date.
2. Retail new/used units and front/back/total gross fill from `DEALINPUT` for that date automatically.
3. Override any pulled total if a deal is still being logged. Use **Refresh from deal log** if deals were added after the date was already selected.
4. Type appointments, shown, showroom visits, and next-day appointments.
5. Save. The same date can be recalled tomorrow.

## Project layout

- `src/reporting.js` — date, retail-deal, gross, traffic, and compatibility rules
- `src/store.js` — JSON store used by the local app
- `public/` — recap UI
- `apps-script/` — copy-safe Google Apps Script package
- `test/` — unit and API tests
