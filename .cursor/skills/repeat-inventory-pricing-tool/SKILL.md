---
name: repeat-inventory-pricing-tool
description: >
  Repeat the Geaux in-sheet new-inventory pricing build for another rooftop,
  brand, or competitor set. Use when the user says "repeat this tool build",
  "build another pricing report", "duplicate the Chevy report", "new inventory
  pricing in the sheet", "detect who hosts the website", "NO STOCK on a
  competitor", "export the report to PDF or Excel", or "let other sheet users
  run this under their login". Covers copying GCY, menu wiring, host detection,
  dealer-discount rules, file export, and editor authorization. Not for quote,
  desking, or ladder tools, and not for changing match rules on a report that
  already exists.
---

# Repeat the in-sheet inventory pricing tool

Build another head-to-head dealer-discount report the way Geaux Chevy was built. Copy the finished Chevy tool. Do not rewrite the scraper, and do not replace the Ford web app.

The live tool is the Apps Script project bound to the sheet. `src/` is an old mirror and is not what the sheet runs.

## What already exists

Ford stays a web app. Chevy stays an in-sheet dialog.

| Piece | Files | How it opens |
| --- | --- | --- |
| Ford web app | `apps-script/NIP_Api.gs`, `NIP_App.html`, `NIP_Menu.gs` | `/exec` and `/exec?page=pricing`. Menu item **Web app link**. |
| Chevy sheet report | `apps-script/GCY_Api.gs`, `GCY_App.html`, `GCY_Menu.gs` | GEAUX REPORTS → New Inventory Pricing → Geaux Chevy. No page parameter. |
| Menu owner | `apps-script/Code.gs` | The only `function onOpen(`. Blueprint line `{ title: 'New Inventory Pricing', onOpen: 'NIP_onOpen' }`. |
| Web app owner | The sheet's `CustomerQuote.gs` | The only `function doGet(e)`. That file is not in this repo. The user pastes it from the Apps Script editor. |

`NIP_onOpen` nests both items:

```javascript
.createMenu('New Inventory Pricing')
.addItem('Geaux Chevy', 'GCY_open')
.addItem('Web app link', 'NIP_showWebAppUrl')
```

Copy `GCY_*`, not `NIP_*`. GCY already detects the website host and exports PDF and Excel. NIP does not.

## Collect these before editing

Ask only for what the user has not already given:

- Prefix: 2–4 letters, unique in the project. Chevy is `GCY`.
- Menu label. Example: `Geaux GMC`.
- Dialog title, banner, heading, and hint.
- Home store name and the website they type. If that host only redirects or is blocked, also get the host that actually serves inventory.
- Up to 5 competitor websites, each with a 2–3 letter column code.
- Brand. Chevy lines and trims are already in `GCY_line_` and `GCY_align_`. Another brand needs its own lists, longest names first (`blazer ev` before `blazer`, `silverado 2500 hd` before `silverado`).

The in-sheet copy does not get a `?page=` value. Leave the Ford address on `/exec` and `/exec?page=pricing`.

## Copy the three files

1. Copy `GCY_Api.gs`, `GCY_App.html`, and `GCY_Menu.gs` to `PREFIX_Api.gs`, `PREFIX_App.html`, and `PREFIX_Menu.gs`.
2. Replace every `GCY_` with `PREFIX_`, including `google.script.run.GCY_compare` and `google.script.run.GCY_exportReport`.
3. Point `createHtmlOutputFromFile` at `PREFIX_App`.
4. In the HTML, set the banner, heading, hint, source sentence, home URL, and the default competitor URLs in the `add('https://...')` calls.
5. Put the same column-code tests in both places. The dialog uses `code(dealer)` in `PREFIX_App.html`. The file uses `PREFIX_code_` in `PREFIX_Api.gs`. A host the regex misses becomes initials, so a store the user cares about needs an explicit pattern in both.
6. Add a marketing-domain redirect in `PREFIX_origin_` when the typed site is not the inventory host. Chevy does this for `www.geauxchevy.com` → `https://www.geauxchevrolet.com` and `www.gerrylanechevy.com` → `https://www.gerrylanechevrolet.com`. Match the full origin, then return the inventory origin. Leave every other host unchanged.

Leave `NIP_*` and `GCY_*` in place.

Do not add `function onOpen`, `onEdit`, `doGet`, or `doPost` in the copied files. The copied files do not write `DEALINPUT`, `DESKDATA`, or `LOGDEAL`.

## Menu

Add one item in `NIP_onOpen`, above **Web app link**:

```javascript
.addItem('Menu Label', 'PREFIX_open')
```

Do not add a second top-level GEAUX REPORTS entry, and do not remove **Web app link**. `SpreadsheetApp.getUi().alert` needs three arguments: title, message, and `ButtonSet.OK`. Two strings throw.

`Code.gs` already nests `NIP_onOpen`. Do not add another `function onOpen(`.

Extend `test/menu.test.js` so it asserts `addItem('Menu Label', 'PREFIX_open')`, `function PREFIX_open(`, `function PREFIX_exportReport(`, and that `Code.gs` still has exactly one `function onOpen(`. Assert the new files contain no `function doGet(`.

## Web app

Do not touch `doGet` for an in-sheet report. One project has one `doGet`, in `CustomerQuote.gs`. Quote links use `?token=`. Brochures use `?brochure=`. The bare `/exec` address opens the Ford report.

If the user also wants a public page, read their current `doGet` before editing it. Do not paste a second `function doGet`. Do not leave the old function body under the new one. A `return` after the closing `}` is the "Illegal return statement" error.

Token and brochure stay first. A new page is next. The bare address stays on Ford:

```javascript
function doGet(e) {
  var token = e && e.parameter && e.parameter.token ? e.parameter.token : null;
  var brochureId = e && e.parameter && e.parameter.brochure ? e.parameter.brochure : null;
  var page = e && e.parameter && e.parameter.page ? String(e.parameter.page) : '';
  if (token || brochureId) {
    // existing quote and brochure body, unchanged
  }
  if (page === 'PAGE') return PREFIX_serveWebApp_();
  return NIP_serveWebApp_();
}
```

Deploy → Manage deployments → pencil on the deployment whose `/exec` URL they open → Version: New version → Deploy. A brand-new deployment creates a second address and leaves the old address on the old version. An in-sheet-only copy does not need a new deployment. Reload the sheet.

## Host detection

`PREFIX_scrapeSite_` fetches the origin, then `PREFIX_platform_` reads the HTML. Do not hard-code a dealer to a platform except for the origin redirect above. When a site shows NO STOCK and the store has the vehicles, the feed was missed. Read the homepage (or one vehicle page if the homepage is a block page) and route on the marker that is present:

| Marker in the HTML | Platform | Feed |
| --- | --- | --- |
| `dealeron_tagging_data` | DealerOn | Cosmos SRP: `/api/vhcliaa/vehicle-pages/cosmos/srp/vehicles/{dealerId}/{pageId}?pn=96&pt={page}` from `/searchnew.aspx`. Discount is the exact key `calc_Dealer Discount` inside base64 `VehiclePriceLibrary`. `Dealer Discount and Accessories` is a fee. |
| `accountId` plus `dealer.com`, `DDC.WS`, or `websiteProviderId":"ddc"` | Dealer.com | POST `/api/widget/ws-inv-data/getInventory` with `siteId`, `pageAlias: 'INVENTORY_LISTING_DEFAULT_AUTO_NEW'`, `widgetName: 'ws-inv-data'`, `includePricing: true`, `inventoryType: 'new'`, `pageSize: '48'`. Walk `start` until `pageInfo.totalCount`. |
| `dealer-inspire` or `algoliaConfig` | Dealer Inspire | Sitemap plus vehicle pages, or the Algolia index already in the file. |
| Homepage blocked, and a vehicle URL matches `/new/{make}/20xx-` | Dealer.com recovered from the sitemap | `PREFIX_dealercomFromSitemap_` loads one vehicle page, confirms the platform, then uses the same POST feed. |

Dealer.com discount, in `PREFIX_dealercomDiscount_`:

- A price row with `isDiscount: true` counts.
- An unconditional offer whose disclaimer says "Dealer discount off MSRP" counts (`conditional` must be false, cash is `specific.cashOption`).
- Customer Cash, Bonus Cash, Military, College, First Responder, and conditional offers do not count.
- Doc fees, invoice lines, and sale-price lines are not the discount.
- A new vehicle with an MSRP and no dealer line stays on the report at a $0 dealer discount.

If `/searchnew.aspx` is DealerOn and the homepage was blocked or empty, still use the DealerOn feed. Sitemap `+` and `%2B` are stripped before `UrlFetchApp`, because Sheets turns `+` into a space. Dealer Inspire URLs look like `/inventory/new-2026-...` and are not DealerOn. DealerOn URLs look like `/new-Hammond-2026-...`.

## Rules the copy keeps

- The match key is `year|make|model|trim`. A 2027 row is not the 2026 row.
- A row exists only when the home store has that year, make, model, and trim in stock. Competitor-only years stay off the report.
- A competitor with no units on that key shows `NO STOCK`. A competitor that has the vehicle at a $0 dealer discount shows `$0`.
- Gap is how much more the deepest competitor discounts than the home store on that same key. The home store leading prints `+$…`. A tie prints `even`. No competitor stock prints `NO STOCK`.
- Strip cab, drivetrain, body style, and package codes before matching. Keep model lines distinct (`Blazer EV` is not `Blazer`, `Silverado 2500 HD` is not `Silverado 1500`).
- On a vehicle-page scrape, an MSRP with no dealer line is stored as `$0` and still counts as stock.
- Progress stages stay `SCANNING COMPETITORS`, `EXTRACTING DATA`, `MATCHING MODELS`, `BUILDING REPORT`. The bar is client-side. It advances every 8 seconds and stops at 92% until `google.script.run` returns, then jumps to 100%.

## Excel and PDF

Keep the export that `GCY_exportReport` and `GCY_exportTable_` already implement. After the prefix rename it works without a new design.

- **Export Excel** and **Export PDF** stay disabled until the comparison returns rows.
- The client sends a slim copy of the job (`home`, `pulledAt`, dealers, rows, and per-vehicle stock, VIN, discount, percent). The server builds the grid with `PREFIX_exportTable_`. That function is pure and is what the unit test calls.
- Excel is a `.xlsx` with sheet `Comparison` (the on-screen table) and sheet `Vehicles` (store, year, make, model, trim, stock, VIN, dealer discount, percent).
- PDF is landscape tabloid, fit-to-width, of the Comparison sheet only (`format=pdf`, `portrait=false`, `fitw=true`, `size=1`, `gid` of that sheet).
- The script creates a temporary spreadsheet with `SpreadsheetApp.create`, fills it, downloads it with `UrlFetchApp` and `ScriptApp.getOAuthToken()`, returns base64, and moves that file to trash in `finally`. The download name is `Geaux-Chevy-Discount-Position-YYYY-MM-DD` with the new title and `pulledAt` date. Change the title and file name in `PREFIX_exportTable_`.
- The dialog tries the download, and also shows a **Download …** link when the browser drops the automatic click.
- `appsscript.json` already has `spreadsheets`, `drive`, and `script.external_request`. Do not add scopes. A non-200 or HTML body from the export URL means the user still needs to approve the spreadsheet permission.

## Other people using the tool

The Chevy dialog runs as the person who clicks the menu, under that person's Google login. The Ford web app does not. Its deployment is execute-as the deployer, anyone. Do not change that deployment to "User accessing the web app" to fix sheet access. That would change quote links and the Ford page.

To let someone else run the in-sheet report:

1. Share the Google Sheet as **Editor**. Viewers and commenters do not get the custom menu.
2. They reload the sheet, then open GEAUX REPORTS → New Inventory Pricing → the new item.
3. The first run asks them to review permissions and choose their own account. They authorize the bound script. They do not need to be an owner of the Apps Script project.
4. The first Excel or PDF export can ask again, because it creates a file in their Drive and then trashes it.
5. Each person gets their own authorization. One editor approving it does not approve it for the others.

## Tests

Add a `test/{prefix}.test.js` that loads `PREFIX_Api.gs` with `new Function` and checks:

- `PREFIX_origin_` sends a marketing domain to the inventory host and leaves a normal host alone.
- `PREFIX_platform_` returns `dealeron`, `dealer.com`, and `inspire` from the markers above.
- A Dealer.com sample keeps `isDiscount` rows and an unconditional "Dealer discount off MSRP" offer, and drops manufacturer cash and doc fees.
- `PREFIX_rows_` keeps a home unit with a $0 dealer discount and omits a year the home store does not stock.
- `PREFIX_exportTable_` matches the on-screen columns: money, `NO STOCK`, leader code, gap, `+$` when the home store leads, and one Vehicles row per unit.

Run `npm test`.

## After the copy

Tell the user which files to paste into the bound Apps Script project (`PREFIX_Api.gs`, `PREFIX_App.html`, `PREFIX_Menu.gs`, and `NIP_Menu.gs` if the menu item changed). Tell them to save and reload the sheet. The new item is under New Inventory Pricing. **Web app link** still opens the Ford `/exec?page=pricing` address. Export stays disabled until a comparison returns rows. The first export may ask them to approve spreadsheet access, then downloads the file and trashes the temporary spreadsheet.

## Chevy, as built

Use this when the user is extending Geaux Chevy rather than starting a new prefix.

- Home: `https://www.geauxchevy.com`, scraped at `https://www.geauxchevrolet.com` (Dealer Inspire).
- Competitors and codes: Supreme `supremechevy.com` SC (DealerOn), Ross Downing `rossdowningchevrolet.com` RD (DealerOn), Best `bestchevrolet.com` BE (DealerOn), Matt Bowers Chevy Metairie `mbchevymetairie.com` MB (Dealer.com), Gerry Lane `gerrylanechevy.com` GL, scraped at `gerrylanechevrolet.com` (Dealer.com).
- Dialog title: `Geaux Chevy discount position`. Banner: `COMPETITIVE PRICING — LAPLACE`.
- A blocked homepage is not "no inventory." Ross Downing is DealerOn via `/searchnew.aspx`. Matt Bowers and Gerry Lane are Dealer.com via the inventory POST. Gerry Lane's short domain is the one that blocks.
