# BarrientCursor — GEAUX Shared Desking + Customer Quote

Google Apps Script project that replaces individual desking sheets with:

1. A shared HTML desking dialog (`deskingDialog.html`)
2. An internal print worksheet (`deskPrint.html`) with the official GEAUX Chevrolet logo (no Supreme Automotive Group wordmark)
3. An interactive customer quote (`customerQuote.html`) whose **coverages, accessories, APRs, FICO labels, fees, store name, and notification emails are edited in spreadsheet sheets — not hardcoded in HTML.**

Copy every `.gs` and `.html` file plus `appsscript.json` into a container-bound Apps Script on `GEAUXCHEVROLETSALESLOG` (or `clasp push`). Copy the PDFs in `brochures/` into a Drive folder named **GEAUX Quote Brochures** (same folder as the spreadsheet).

## First run

1. Reload the spreadsheet. **GEAUX Desk** appears on the Google Sheets menu bar (to the right of Help), not in GitHub and not as a tab at the bottom of the workbook.
   - If it is missing: **Extensions → Apps Script**, confirm `Code.gs` with `createMenu('GEAUX Desk')` is in the script bound to this spreadsheet, then reload. First run: **Run → onOpen** in the Apps Script editor and click Allow.
2. **GEAUX Desk → Open Desking Tool.** Salesperson, manager, term, and credit-tier lists are filled when the window opens (no extra wait). **GEAUX Desk → Create/refresh config sheets** creates `QUOTE_CATALOG` if needed.
3. Confirm these sheets exist and edit them as needed:
   - `CONFIG` — fees, store city/phone, quote TTL, notify emails, default term
   - `MANAGER_STAGING` — optional manager name match → DESKDATA staging row (1–4). Blank or unmatched names use row 1. Not required to save, print, or quote.
   - `QUOTE_CATALOG` — optional coverages (id, name, description, **price**, brochure URL, provider). Change the Price column anytime — no code deploy.
   - `QUOTE_RATES` — APR matrix (term × a1–b3). Blank cell = not offered
   - `CREDIT_TIERS` — labels and FICO bands shown to the customer
4. **GEAUX Desk → Publish quote brochures** after the PDFs are in the Drive folder. That writes view links into `QUOTE_CATALOG` BrochureUrl. You can also paste any URL into that column by hand.
5. Deploy **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (customers do not have Google logins)
6. Paste the web app URL into `setWebAppUrl()` (or a `webAppUrl` row in `CONFIG`) and run it.

Existing `SETUP` (salespeople A7:A52, managers A57:A62), `INV`, and `DESKDATA` keep working. `DESKDATA` history now uses **73 columns** (days-to-first and first payment date at the end).

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
