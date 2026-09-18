# BarrientCursor — GEAUX Shared Desking + Customer Quote

Google Apps Script project that replaces individual desking sheets with:

1. A shared HTML desking dialog (`deskingDialog.html`)
2. An internal print worksheet (`deskPrint.html`)
3. An interactive customer quote (`customerQuote.html`) whose **packages, accessories, APRs, FICO labels, fees, store name, and notification emails are edited in spreadsheet sheets — not hardcoded in HTML.**

Copy every `.gs` and `.html` file plus `appsscript.json` into a container-bound Apps Script on `GEAUXCHEVROLETSALESLOG` (or `clasp push`).

## First run

1. Reload the spreadsheet. The **GEAUX Desk** menu appears.
2. **GEAUX Desk → Create/refresh config sheets** (also runs automatically when you open the desking tool).
3. Confirm these sheets exist and edit them as needed:
   - `CONFIG` — fees, store city/phone, quote TTL, notify emails, default term
   - `MANAGER_STAGING` — manager name match → DESKDATA staging row (1–4)
   - `QUOTE_CATALOG` — protection + accessory menu (id, name, price, taxable, defaultOn, active)
   - `QUOTE_RATES` — APR matrix (term × a1–b3). Blank cell = not offered
   - `CREDIT_TIERS` — labels and FICO bands shown to the customer
4. Deploy **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (customers do not have Google logins)
5. Paste the web app URL into `setWebAppUrl()` (or a `webAppUrl` row in `CONFIG`) and run it.

Existing `SETUP` (salespeople A7:A52, managers A57:A62), `INV`, and `DESKDATA` keep working. `DESKDATA` history now uses **73 columns** (days-to-first and first payment date at the end).

## Changing customer quote options (no code deploy)

| What to change | Where |
|---|---|
| Add/rename/price a warranty, GAP, tint, etc. | `QUOTE_CATALOG` (set Active to FALSE to hide) |
| Change APRs or which terms a tier can use | `QUOTE_RATES` |
| FICO wording on the quote | `CREDIT_TIERS` |
| Doc fee, tax rate, store phone, email list | `CONFIG` |
| Per-deal term lock / pre-checked packages | Desking tool **Customer Quote Options** panel |

Each shareable link **snapshots** the catalog and rates at send time, so editing the sheets later does not rewrite a link already in a customer’s texts.

## Deal / quote rules

- Save, print, and quote require a manager that matches `MANAGER_STAGING`. Unknown names no longer overwrite row 1.
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
