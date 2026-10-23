# GEAUXCHEVROLETSALESLOG — live workbook inventory

Spreadsheet: `1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

Read on 2026-09-01. Apps Script source is not included in a Sheet export, so install still avoids reserved trigger names.

## What already exists for sales

| Tab | Role | SLM may write? |
| --- | --- | --- |
| `DEALINPUT` | Operational deal log. Headers on row 5. `DATE`, `TYPE`, `DEPT`, `F TOTAL` (col 17), `FIN TOTAL` (col 26), `TOTAL GROSS` (col 27). | No. Read-only for a retail totals hint. |
| `SUMMARY` | MTD plus a SINGLE DAY new/used front/back/total recap driven by `DEALINPUT`. | No |
| `HOME` | Sales navigation hub | No |
| `LOGDEAL` | Single-deal worksheet | No |
| `MANAGER` / `SALESREP` | Pay and lender recaps | No |
| `SMR_*` | Service Manager Report tabs, if installed | No |

Retail `TYPE` values in the live file are `Retail` / `RETAIL`. `DEPT` is `New` / `Used` (plus wholesale / dealer trade rows that SLM ignores).

Last logged retail day when this was read: 2026-08-31 (5 new, 2 used).

## How SLM fits

SLM adds only `SLM_Dashboard`, `SLM_Daily`, and `SLM_Config`.

- End-of-day units and gross live on `SLM_Daily`, even when they started as a `DEALINPUT` hint.
- Appointments, shown, showroom visits, and next-day appointments are typed by the sales manager. They do not exist on `DEALINPUT`.
- `SUMMARY` stays the sales-side MTD formula sheet.

## Protected tabs

Do not rename or delete the live workbook’s existing sheets. SLM never writes them. Service `SMR_*` tabs are also protected so both briefings can share the file.
