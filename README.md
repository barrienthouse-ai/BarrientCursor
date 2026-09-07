# Parts Manager Report

Reporting tool for the Geaux Chevrolet parts department. The parts manager enters the daily CDK briefing; the general manager sees inventory capital, obsolescence, service-drive wait, GM RIM, special orders, backorders, cores, and wholesale route health without opening the sales log.

This follows the same collision-safe pattern as the Sales Manager Report (`SLM_`), Service Manager Report (`SMR_`), and Fleet Manager Report (`FLM_`). Service already leaves parts gross at zero and points here.

## What it tracks

1. **Inventory & capital health** — true on-hand dollars vs monthly capital limit, open payables, N3M / N6M (90+ day) obsolescence, and pad/overstock bought for GM RIM/PDI.
2. **Service drive** — technician counter wait (flag over 5–7 minutes), lost sales log, special-order parts received but not installed (7-day bottleneck / 14-day non-returnable risk).
3. **OEM / GM programs** — RIM compliance vs target, emergency / CSO orders and premium freight, critical backorders (EV, transmissions, modules) holding body or service.
4. **Wholesale & cores** — outstanding core dollars, wholesale stops, hot-shots, and fuel.

CDK pull list the manager uses each morning:

| Priority | CDK code | What to type into this briefing |
| --- | --- | --- |
| On-hand $ | `MGR` → `INV` | Inventory investment vs payables |
| Dead stock | `RSM` / `RST` | N3M and N6M by source |
| SOP aging | `SOP` → `RO` | REC parts on open repair orders |
| Lost sales | `LSL` | Looked up, not sold, out of stock |
| RIM receipts | `IRE` | Share ordered through GM RIM |
| Emergency / CSO | `ORD` | Premium freight volume |
| Cores | `CRA` | Outstanding core dollars |

There is no CDK API in this repo. The manager pulls those native CDK functions and types the daily snapshot here, the same way service types hours and fleet types deliveries.

## Three ways to use it

1. **Standalone web app** — deploy `apps-script-web/` as a link. The parts manager never opens the sales log. Save and recall still write `PMR_*` tabs in GEAUXCHEVROLETSALESLOG. See `apps-script-web/INSTALL.md`.
2. **In the live workbook** — paste `apps-script/` into Extensions → Apps Script. It only creates `PMR_*` tabs and `PMR_*` functions. Never paste `PMR_Web.gs` there.
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
2. Pull CDK `INV`, `RSM`/`RST`, `SOP`→`RO`, `LSL`, `IRE`, `ORD`, and `CRA`.
3. Type on-hand dollars, N3M/N6M, wait minutes, RIM %, CSO, cores, and route numbers.
4. Log repeating lost-sale part numbers, REC special orders, critical backorders, and outstanding cores on **Boards**.
5. Save. Email the GM recap when report email is set on `PMR_Config`.
6. The same date can be recalled tomorrow. Leadership can also read `PMR_Dashboard`.

## Project layout

- `src/reporting.js` — capital, wait, RIM, SOP aging, lost-sales repeats, alerts, and compatibility rules
- `src/store.js` — JSON store used by the local app
- `src/email.js` — branded Geaux GM recap
- `public/` — briefing UI
- `apps-script/` — copy-safe Google Apps Script package for the live workbook (no `doGet`)
- `apps-script-web/` — standalone `doGet` web app that opens that workbook by ID
- `test/` — unit and API tests
