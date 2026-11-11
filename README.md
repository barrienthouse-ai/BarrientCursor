# Deal Logger for Google Sheets

A side-panel tool inside Google Sheets for logging sales deals into a `Deals` tab.

## What you get

- **Deal Logger** menu in Sheets → **Open sidebar**
- Side window form: deal name, company, amount, stage, probability, close date, owner, notes
- Appends rows to a `Deals` sheet (created automatically with headers)
- Recent deals list in the sidebar
- Stage-based default win probability

## Install in a spreadsheet (fastest)

1. Open the Google Sheet where you want deals logged (or create a blank one).
2. **Extensions → Apps Script**.
3. Delete any stub `Code.gs` content.
4. Copy this repo’s `Code.gs` into the Apps Script editor.
5. Click **+ → HTML** and name the file `Sidebar` (Apps Script adds `.html`).
6. Paste this repo’s `Sidebar.html` contents into that file.
7. Open **Project Settings** and confirm the time zone if you care about timestamps.
8. Save, then reload the spreadsheet.
9. Authorize when prompted: **Deal Logger → Open sidebar**.

The first open creates a `Deals` sheet with column headers.

## Optional: deploy with clasp

```bash
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
# put your scriptId into .clasp.json
clasp push
```

## Local UI preview

```bash
cd preview
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765). Saves stay in-memory only.

## Offline validation test

```bash
node test/deal-validation.test.js
```

## Sheet columns

| Logged At | Deal Name | Company | Amount | Stage | Probability % | Expected Close | Owner | Notes |
|---|---|---|---|---|---|---|---|---|
