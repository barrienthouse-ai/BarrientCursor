# GEAUXCHEVROLETSALESLOG — live workbook inventory

Spreadsheet: `1UO5BzN7LmPovfpOWfbnfKwwtDVmUSM9y08mRSeNu46w`

Read for the Parts Manager Report install. Apps Script source is not included in a Sheet export, so install still avoids reserved trigger names.

## What already exists for parts

| Tab | Role | PMR may write? |
| --- | --- | --- |
| `PARTS_ITEMS` | Operational parts catalog | No |
| `PARTS_TICKETS` / `PARTS_TICKET_LINES` | Parts tickets tied to ROs | No |
| `SVC_PARTS_REQUESTS` | Service parts requests | No |
| `SUMMARY` | Sales MTD plus Service/Parts/Body Shop MTD cells | No |
| `HOME` | Sales navigation hub | No |
| `SMR_*` | Service Manager Report. Service gross leaves parts at `0` and points to a separate tool. | No |
| `SLM_*` | Sales Manager Report | No |
| `FLM_*` | Fleet Manager Report | No |

Those `PARTS_*` tabs are a working ticket file, not a daily GM briefing. Capital, RIM, LSL, SOP aging, cores, and counter wait do not exist as a daily log anywhere in the workbook. CDK remains the system of record; this tool is the briefing the parts manager types after pulling CDK.

## How PMR fits

PMR adds only `PMR_Dashboard`, `PMR_Daily`, `PMR_LostSales`, `PMR_Sop`, `PMR_Backorders`, `PMR_Cores`, and `PMR_Config`.

- Daily CDK snapshot lives on `PMR_Daily`.
- Open boards (lost sales, SOP REC, backorders, cores) live on their own `PMR_*` tabs until closed.
- `SUMMARY` Parts MTD stays a sales-side formula. `SMR_Gross` Parts stays unused.

## All existing tabs (do not rename or delete)

Visible: `HOME`, `SUMMARY`, `DEALINPUT`, `salesreview`, `NEWVEHICLES`, `INV`, `TREND`, `SETTLEUP`, `MANAGER`, `SALESREP`, `REBATE`, `HITLIST`, `SETUP`, `CUSTOMER_RESPONSES`, `SERVICE BOARD`, `FLEET CUSTOMERS`, `DESKDATA`, `USEDCARS`, `DMV`, `PURCHASEPAPERWORK`, `PURCHASEUNITS`, `GMFRESIDUALGUIDE`, `YTD`, `WORKTOOLS`, `LEASEWORKSHEET`, `DTLOG`, `DTDEALERDATABASE`, `CONSOLIDATION`, `RECEIPTS`, `AUDITLOG`, `LOGDEAL`, `storage`

Hidden / system: `PARTS_ITEMS`, `SVC_PARTS_REQUESTS`, `PARTS_TICKETS`, `PARTS_TICKET_LINES`, `ACCT_COA`, `SVC_RO`, `SVC_RO_LINES`, `ACCT_JOURNAL`, `ACCT_UNIT_META`, `ACCT_UNIT_POSTINGS`, `ADMIN_EMPLOYEES`, `Deals_Database`, `PSCREEN`, `DEALTRADES`, `DEALGROSS`, `DEALVEHICLE`, `DEALCUSTOMER`, `DEALREBATES`, `DEALRECAP`, `DEALWEOWE`, `DEALLIENHOLDER`, `CUSTOMER`, `DATA`, `ACCOUNTINGREBATE`, `INVENTORY`, `CHARGEBACKS`, `ACCOUNTINGENTRY`, `LEASEWORKSHEETLOG`, `LEASEWORKSHEETLOG2`, `EMAIL_QUEUE`, `DAVID DESKING`, `KERRY DESKING`, `KEITH DESKING`, `FINANCEDATABASE`, `STEVE DESKING`, `QUOTE_STORE`, `DO NOT DELETE - AutoCrat Job Se`

Sibling department tools may also have added `SLM_*`, `SMR_*`, and `FLM_*`. PMR never writes those.
