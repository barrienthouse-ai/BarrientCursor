# GEAUXCHEVROLETSALESLOG — live workbook inventory

Spreadsheet: `1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

Read on 2026-08-29 after the file was shared as **Anyone with the link**. Apps Script source is **not** included in a Sheet export, so function names inside Extensions → Apps Script still need a paste if you want a line-by-line collision check. Sheet names, headers, and sample rows were enough to keep the Service Manager Report isolated.

## What already exists for service

| Tab | Role | SMR may write? |
| --- | --- | --- |
| `SERVICE BOARD` | Weekly Mon–Fri sold-hours grid for shop nicknames | No. Read-only for roster import. |
| `SVC_RO` | Hidden RO header table (`RoNumber`, `Status`, `Labor`, `Parts`, `FullJSON`) | No. Optional read for open/closed counts. |
| `SVC_RO_LINES` | Hidden job lines (tech, hours, pay type W/I/CP) | No |
| `SVC_PARTS_REQUESTS`, `PARTS_*` | Parts tickets tied to ROs | No |
| `SUMMARY` | Sales MTD plus Service/Parts/Body Shop MTD cells (currently `0`, driven by `DEALINPUT`) | No |
| `HOME` | Sales navigation hub | No |
| `ADMIN_EMPLOYEES` | Employee master, including service staff | No |

`SERVICE BOARD` techs in the live file:

`BIG AL`, `ELECTRIC-T`, `DIESEL-E`, `INTERNAL-F`, `HEAVY-C`, `SPECIAL-K`, `LIL-J`, `EASY-E`, `DUEL FUEL-A`

Service employees in `ADMIN_EMPLOYEES`:

- Justin Mumphrey — Technician
- Joey Delatte — Technician
- Cody Raffary — Service Advisor (also titled Service Manager)

`SVC_RO` currently has two sample tickets (`RO5001` OPEN, `RO5002` CLOSED). That is a working RO writer, not a daily briefing log. Heat cases do not exist anywhere in the workbook.

## All 69 tabs (do not rename or delete)

Visible: `HOME`, `SUMMARY`, `DEALINPUT`, `salesreview`, `NEWVEHICLES`, `INV`, `TREND`, `SETTLEUP`, `MANAGER`, `SALESREP`, `REBATE`, `HITLIST`, `SETUP`, `CUSTOMER_RESPONSES`, `SERVICE BOARD`, `FLEET CUSTOMERS`, `DESKDATA`, `USEDCARS`, `DMV`, `PURCHASEPAPERWORK`, `PURCHASEUNITS`, `GMFRESIDUALGUIDE`, `YTD`, `WORKTOOLS`, `LEASEWORKSHEET`, `DTLOG`, `DTDEALERDATABASE`, `CONSOLIDATION`, `RECEIPTS`, `AUDITLOG`, `LOGDEAL`, `storage`

Hidden / system: `PARTS_ITEMS`, `SVC_PARTS_REQUESTS`, `PARTS_TICKETS`, `PARTS_TICKET_LINES`, `ACCT_COA`, `SVC_RO`, `SVC_RO_LINES`, `ACCT_JOURNAL`, `ACCT_UNIT_META`, `ACCT_UNIT_POSTINGS`, `ADMIN_EMPLOYEES`, `Deals_Database`, `PSCREEN`, `DEALTRADES`, `DEALGROSS`, `DEALVEHICLE`, `DEALCUSTOMER`, `DEALREBATES`, `DEALRECAP`, `DEALWEOWE`, `DEALLIENHOLDER`, `CUSTOMER`, `DATA`, `ACCOUNTINGREBATE`, `INVENTORY`, `CHARGEBACKS`, `ACCOUNTINGENTRY`, `LEASEWORKSHEETLOG`, `LEASEWORKSHEETLOG2`, `EMAIL_QUEUE`, `DAVID DESKING`, `KERRY DESKING`, `KEITH DESKING`, `FINANCEDATABASE`, `STEVE DESKING`, `QUOTE_STORE`, `DO NOT DELETE - AutoCrat Job Se`

Those hidden `FullJSON` tabs plus `EMAIL_QUEUE`, `QUOTE_STORE`, and the AutoCrat job sheet are owned by the current automation. SMR never writes them.

## How SMR fits

SMR adds only `SMR_Dashboard`, `SMR_TechHours`, `SMR_Gross`, `SMR_HeatCases`, `SMR_RepairOrders`, `SMR_Roster`, and `SMR_Config`.

- Daily tech hours with date recall live on `SMR_TechHours`. That does not replace the weekly `SERVICE BOARD`.
- Daily / monthly service gross live on `SMR_Gross`. `SUMMARY` Service MTD stays a sales-side formula.
- Open / closed / written RO counts the manager types each day live on `SMR_RepairOrders`. `SVC_RO` stays the operational RO file.
- Heat cases are new on `SMR_HeatCases`.
