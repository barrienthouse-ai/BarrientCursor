---
name: duplicate-inventory-pricing
description: >
  Duplicate the Geaux new-inventory pricing report for another rooftop, brand,
  or competitor set. Use when the user says "duplicate this report", "clone the
  pricing report", "copy NIP", "another discount comparison", "new inventory
  pricing for another store", or wants a second head-to-head dealer-discount
  report in the same Google Sheet. Covers the Apps Script copy, menu wiring,
  and the single existing doGet. Not for changing match rules on the Ford
  report that already exists, and not for the quote, desking, or ladder tools.
---

# Duplicate the inventory pricing report

Copy the live report. Do not rewrite the scraper. The live tool is the Apps Script project bound to the sheet. `src/` is an old mirror and is not what the sheet runs.

The original report is prefix `NIP`:

- `apps-script/NIP_Api.gs` — scrape, dealer-discount parse, year/make/model/trim match
- `apps-script/NIP_App.html` — dialog and web page
- `apps-script/NIP_Menu.gs` — menu, modal, web-app page
- `apps-script/Code.gs` — the only `onOpen`, menu blueprint
- The sheet's `CustomerQuote.gs` — the only `doGet`. That file is not in this repo. The user pastes it from the Apps Script editor.

## Collect these before editing

Ask only for what the user has not already given:

- Prefix: 2–4 letters, unique in the project. Example: `GMC`.
- Menu title. Example: `GMC Inventory Pricing`.
- Page parameter, lowercase, unique. Example: `gmc`. The URL ends in `?page=gmc`.
- Home store name and website.
- Up to 5 competitor websites, each with a 2–3 letter column code.
- Banner line and page title.
- Brand. Ford keeps the existing model and trim lists. Any other brand needs its lines and trims added. Longest names first (`bronco sport` before `bronco`, `expedition max` before `expedition`).

## Copy the three files

1. Copy `NIP_Api.gs`, `NIP_App.html`, and `NIP_Menu.gs` to `PREFIX_Api.gs`, `PREFIX_App.html`, and `PREFIX_Menu.gs`.
2. Replace every `NIP_` with `PREFIX_`, including the client call `google.script.run.NIP_compare`.
3. In the menu file, point `createHtmlOutputFromFile` at `PREFIX_App`.
4. In the show-URL function, append `?page=PAGE` (or `&page=PAGE` when the address already has a query). `SpreadsheetApp.getUi().alert` needs three arguments: title, message, and `ButtonSet.OK`. Two strings throw.
5. In the HTML, set the banner, heading, hint, source sentence, home URL, competitor URLs, and column codes. The progress stages stay `SCANNING COMPETITORS`, `EXTRACTING DATA`, `MATCHING MODELS`, `BUILDING REPORT`. The bar is client-side. It advances every 8 seconds and stops at 92% until `google.script.run` returns, then jumps to 100%.

Leave `NIP_*` in place. The original Ford report keeps working.

## Menu

`Code.gs` owns the only `onOpen`. Add one object inside `reports` in `geauxMenuBlueprint_()`:

```javascript
{ title: 'Menu Title', onOpen: 'PREFIX_onOpen' }
```

Do not add `function onOpen`, `onEdit`, `doGet`, or `doPost` in the copied files. `nestOnOpenMenus_` nests `PREFIX_onOpen` under GEAUX REPORTS.

Extend `test/menu.test.js` so it asserts the new blueprint line, `function PREFIX_onOpen(`, and that `Code.gs` still has exactly one `function onOpen(`. Run `npm test`.

## Web app

One Apps Script project has one `doGet`. It lives in `CustomerQuote.gs`. Quote links use `?token=`. Brochures use `?brochure=`. The bare `/exec` address currently opens the original pricing report.

Read the user's current `doGet` before editing it. Insert the new page check. Do not paste a second `function doGet`. Do not leave the old function body under the new one. A `return` after the closing `}` is the "Illegal return statement" error.

Token and brochure stay first. The new page is next. The bare address stays on the original report:

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

If their `doGet` still has the quote body inline, keep that body and put `if (page === 'PAGE') return PREFIX_serveWebApp_();` immediately before the line that returns `NIP_serveWebApp_()` for requests with no token and no brochure.

`PREFIX_serveWebApp_`, `PREFIX_App.html`, and `PREFIX_Api.gs` must be in the same Apps Script project as `CustomerQuote.gs`. A missing function shows `PREFIX_serveWebApp_ is not defined`.

Deploy → Manage deployments → pencil on the deployment whose `/exec` URL they open → Version: New version → Deploy. A brand-new deployment creates a second address and leaves the old address on the old version. The original report stays at `/exec` and `/exec?page=pricing`. The copy is `/exec?page=PAGE`.

`normalizeWebAppUrl_` strips query strings before it stores the quote URL. Customer links stay `?token=` and do not pick up the pricing page.

## Rules the copy keeps

- Dealer discount only. Customer Cash, Bonus Cash, Military, College, and First Responder are manufacturer rebates and stay out. On DealerOn, the price key is the exact string `calc_Dealer Discount`. `Dealer Discount and Accessories` is a fee, not the discount.
- A vehicle with an MSRP and no dealer line counts as a $0 dealer discount. It stays on the report.
- The match key is `year|make|model|trim`. A 2027 row is not the 2026 row.
- A row exists only when the home store has that year, make, model, and trim in stock. Competitor-only years stay off the report.
- A competitor with no units on that key shows `NO STOCK`. A competitor that has the vehicle at a $0 dealer discount shows `$0`, not `NO STOCK`.
- Gap is how much more a competitor discounts than the home store on that same key.
- Strip cab, drivetrain, body style, package codes (`302A`, `702A`), and upfits (Rocky Ridge, Black Widow, Harley-Davidson, Sasquatch, Bayou Edition) before matching. `Bronco Sport` stays separate from `Bronco`. `Expedition Max` stays separate from `Expedition`.
- Dealer Inspire URLs look like `/inventory/new-2026-...`. Those are not DealerOn. DealerOn URLs look like `/new-Hammond-2026-Ford-...`. `PREFIX_isDealeronUrl_` must keep excluding `/inventory/new-`.
- DealerOn inventory comes from the cosmos JSON feed on `/searchnew.aspx`, not from the VDP HTML. Sitemap pluses are stripped before `UrlFetchApp` (`+` and `%2B`), because Sheets turns `+` into a space.
- Dealer Inspire (Geaux Ford, Hollingsworth) and Robinson Brothers use the sitemap plus the vehicle page. Robinson new vehicles are `/for-sale/` URLs. Skip used and certified.
- The copied files do not write `DEALINPUT`, `DESKDATA`, or `LOGDEAL`.

## After the copy

Tell the user the three files to paste into Apps Script, the one menu line, and the one `doGet` branch. Give them the finished `/exec?page=PAGE` address pattern. Remind them to deploy a new version of the existing web app, then reload the sheet so GEAUX REPORTS shows the new item.
