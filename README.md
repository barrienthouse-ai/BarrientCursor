# BarrientCursor — GEAUX Shared Desking + Customer Quote

Google Apps Script project that replaces individual desking sheets with:

1. A shared HTML desking dialog (`deskingDialog.html`)
2. An internal print worksheet (`deskPrint.html`) with the official GEAUX Chevrolet logo (no Supreme Automotive Group wordmark)
3. An interactive customer quote (`customerQuote.html`) whose **coverages, accessories, APRs, FICO labels, fees, store name, and notification emails are edited in spreadsheet sheets — not hardcoded in HTML.**

Copy every `.gs` and `.html` file plus `appsscript.json` into a container-bound Apps Script on `GEAUXCHEVROLETSALESLOG` (or `clasp push`). Copy the PDFs in `brochures/` into a Drive folder named **GEAUX Quote Brochures** (same folder as the spreadsheet).

## First run

1. Reload the spreadsheet. The menu bar has two items: **GEAUX TOOLS** and **GEAUX REPORTS** (to the right of Help), not in GitHub and not as tabs at the bottom of the workbook.
   - **GEAUX TOOLS:** Lease Engine, Dealer Bonuses, GEAUX Terminal, Service Manager Report (SMR), SLM, GEAUX Desk, Deal Log.
   - **GEAUX REPORTS:** Deal Reports and Dealer Tool Kit.
   - If they are missing: **Extensions → Apps Script**, confirm `Code.gs` is in the script bound to this spreadsheet, then reload. First run: **Run → onOpen** in the Apps Script editor and click Allow.
   - **Delete any other `function onOpen()`** in the same Apps Script project (keep the rest of those files). Two `onOpen` functions cannot share one project. Use `LeaseEngine.gs` for the lease calculator (no `onOpen` in that file).
2. **GEAUX TOOLS → GEAUX Desk → Open Desking Tool.** Salesperson, manager, term, and credit-tier lists are filled when the window opens (no extra wait). **GEAUX TOOLS → GEAUX Desk → Create/refresh config sheets** creates `QUOTE_CATALOG` if needed.
3. Confirm these sheets exist and edit them as needed:
   - `CONFIG` — fees, store city/phone, quote TTL, notify emails, default term
   - `MANAGER_STAGING` — optional manager name match → DESKDATA staging row (1–4). Blank or unmatched names use row 1. Not required to save, print, or quote.
   - `QUOTE_CATALOG` — optional coverages (id, name, description, **price**, brochure URL, provider). Change the Price column anytime — no code deploy.
   - `QUOTE_RATES` — APR matrix (term × a1–b3). Blank cell = not offered
   - `CREDIT_TIERS` — labels and FICO bands shown to the customer
4. **GEAUX TOOLS → GEAUX Desk → Publish quote brochures** after the PDFs are in the Drive folder. That writes view links into `QUOTE_CATALOG` BrochureUrl. You can also paste any URL into that column by hand.
5. Deploy **Deploy → New deployment → Web app**
   - Execute as: **Me** (not User accessing the web app)
   - Who has access: **Anyone** (not “Anyone with a Google account”)
6. **GEAUX TOOLS → GEAUX Desk → Save Web App URL**, then **Test customer Web App**. Incognito + signed out must show a GEAUX page, not Google Drive.
7. **Share a quote:** put the customer email on the desk and click **EMAIL QUOTE**. The customer email tells them to open the attached `Your-GEAUX-Chevrolet-Quote-….html` file (paperclip on a phone). Do not send the Web App test URL to customers.

Existing `SETUP` (salespeople A7:A52, managers A57:A62), `INV`, and `DESKDATA` keep working. `DESKDATA` history now uses **73 columns** (days-to-first and first payment date at the end).

## Deal Log (sold deals — not desking)

`DealManager.gs` + `logDealDialog.html` is a **different tool** from GEAUX Desk. It writes sold deals to `DEALINPUT` through the `LOGDEAL` formula row. It does **not** read or write `DESKDATA`.

1. **GEAUX TOOLS → Deal Log → Open Deal Log Entry** (copy `DealManager.gs` and `logDealDialog.html` into the bound script).
2. Add / Update / Recall / Clear talk to `LOGDEAL` then paste `A1:EC1` into `DEALINPUT`. Protected formula columns stay formulas (`PROTECTED_INDICES` is unchanged).
3. The dialog field **etch** maps to LOGDEAL **paint** (B24). **Spiff 2** is the commissions `spiff2b` box and writes `J31`.
4. Clear resets both the dialog and the LOGDEAL formula cells on the sheet.
5. Sidebar **Deal Manager** (`OPENDEALMANAGER` / `dealDialog.html`) is not in the menu until that HTML file exists. Do not add a second `onOpen()` in `DealManager.gs`.

## Changing customer quote options (no code deploy)

| What to change | Where |
|---|---|
| Selling price of MBI, GAP, UVP, windshield, etc. | `QUOTE_CATALOG` **Price** column |
| Product name, short description, or provider line | `QUOTE_CATALOG` Name / Description / Provider |
| Brochure PDF link | `QUOTE_CATALOG` BrochureUrl, or **Publish quote brochures** |
| Hide a coverage | `QUOTE_CATALOG` Active = FALSE |
| Add another coverage | New `QUOTE_CATALOG` row (`protection` or `accessory`) |
| Change APRs or which terms a tier can use | `QUOTE_RATES` |
| FICO wording on the quote | `CREDIT_TIERS` |
| Doc fee, tax rate, store phone, email list | `CONFIG` |
| Per-deal term lock / pre-checked packages | Desking tool **Customer Quote Options** panel |

Each shareable link **snapshots** the catalog and rates at send time, so editing the sheets later does not rewrite a link already in a customer’s texts.

## Deal / quote rules

- Save, print, and the interactive quote work with any manager name, or none. `MANAGER_STAGING` is optional routing only: a Match substring sends that manager to a DESKDATA row (1–4); everyone else uses row 1. Manager names are never hardcoded.
- Recall and Search look through **all** `DESKDATA` rows (staging 1–4 and history 5+). Type a deal number (`1102` also loads `1102.1`), a partial customer name, or a stock number. One match loads immediately; several matches open the list so you can click one.
- Print still versions history (`1026`, `1026.1`, …). Quote **does not** consume a print version; it keeps the current deal number.
- Deal numbers are assigned under a script lock.
- Quote tokens are UUIDs with an expiry (`quoteTtlDays` in `CONFIG`, default 14).
- Customer JSON and the quote page never include SSN, DOB, or dealer cost. Print also omits SSN.
- Submitted payments are **recomputed on the server** from the snapshot catalog. The browser cannot invent a payment or a fake product id.
- Emails go to `CONFIG.notifyEmails` and only queue a retry if the first send fails.

## Local tests (this repo)

```bash
node test/run.js
```

That checks shared math, redaction, JSON injection, and writes `test/quote-preview.html` / `test/print-preview.html` for a browser smoke test of the injected pages.
