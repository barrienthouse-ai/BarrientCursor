# GEAUXCHEVROLETSALESLOG — live workbook inventory

Spreadsheet: `1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

Read for the Fleet Manager Report install. Apps Script source is not included in a Sheet export, so install still avoids reserved trigger names.

## What already exists for fleet

| Tab | Role | FLM may write? |
| --- | --- | --- |
| `DEALINPUT` | Operational deal log. Headers on row 5. Fleet / Commercial rows are TYPE or DEPT. `F TOTAL`, `FIN TOTAL`, `TOTAL GROSS`. | No. Read-only for a fleet totals hint. |
| `FLEET CUSTOMERS` | Fleet account list used by the sales desk. | No |
| `SUMMARY` | MTD plus a SINGLE DAY recap driven by `DEALINPUT`. | No |
| `HOME` | Sales navigation hub | No |
| `LOGDEAL` | Single-deal worksheet | No |
| `SMR_*` | Service Manager Report tabs, if installed | No |
| `SLM_*` | Sales Manager Report tabs, if installed | No |

Retail `TYPE` values stay on the sales recap. Fleet rows are `Fleet` / `FLEET` / `Commercial`. FLM ignores retail, wholesale, and dealer trades.

## How FLM fits

FLM adds only `FLM_Dashboard`, `FLM_Daily`, `FLM_Working`, `FLM_Goals`, and `FLM_Config`.

- Daily sold units and front / finance / total gross live on `FLM_Daily`, even when they started as a `DEALINPUT` hint.
- Working deals, expected delivery dates, daily deliveries, courtesy deliveries, and the monthly goal are typed by the fleet manager. They do not exist as a daily briefing on `DEALINPUT`.
- `SUMMARY` stays the sales-side MTD formula sheet.

## Protected tabs

Do not rename or delete the live workbook’s existing sheets. FLM never writes them. Service `SMR_*` and sales `SLM_*` tabs are also protected so all three briefings can share the file.
