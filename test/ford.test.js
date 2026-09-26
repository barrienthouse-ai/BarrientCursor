import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../apps-script/NIP_Api.gs", import.meta.url), "utf8");
const api = new Function(`${source}; return { NIP_platform_, NIP_dealercomPage_, NIP_exportTable_, NIP_rows_ };`)();

test("the Ford report reads the website host", () => {
  assert.equal(api.NIP_platform_('<script id="dealeron_tagging_data" type="application/json">{"dealerId":"1"}</script>'), "dealeron");
  assert.equal(api.NIP_platform_('accountId:"billhoodford" https://shop.dealer.com/widget.js DDC.WS.state'), "dealer.com");
  assert.equal(api.NIP_platform_('<script>algoliaConfig = {"appId":"ABC"}</script> dealer-inspire'), "inspire");
  assert.equal(api.NIP_platform_("<html><title>Geaux Ford</title></html>"), "");
});

test("Dealer.com keeps the Ford dealer discount and drops manufacturer cash", () => {
  const parsed = api.NIP_dealercomPage_({
    inventory: [
      {
        type: "new",
        year: 2026,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
        vin: "1FTTEST0000000001",
        stockNumber: "F1",
        link: "/new/Ford/2026-Ford-F-150.htm",
        incentiveIds: ["store_customer"],
        pricing: { dprice: [
          { typeClass: "msrp", label: "MSRP", value: "$55,375" },
          { typeClass: "AsubBRule", isDiscount: true, label: "Dealer Discount", value: "$5,000" },
          { typeClass: "documentFee", label: "Documentation Fee", value: "$436" },
        ] },
      },
      {
        type: "new",
        year: 2026,
        make: "Ford",
        model: "Explorer",
        trim: "XLT",
        vin: "1FMTEST0000000002",
        incentiveIds: ["store_rebate"],
        pricing: { dprice: [
          { typeClass: "msrp", label: "MSRP", value: "$48,000" },
          { typeClass: "SICRule", label: "Customer Cash", value: "$2,000" },
        ] },
      },
    ],
    incentives: {
      "[store_customer]": { conditional: false, disclaimer: "Customer Cash from Ford.", specific: { cashOption: 2000 } },
      "[store_rebate]": { conditional: false, disclaimer: "Bonus Cash.", specific: { cashOption: 1500 } },
    },
  }, "https://www.example.com");
  assert.equal(parsed[0].dealerDiscount, 5000);
  assert.equal(parsed[0].msrp, 55375);
  assert.equal(parsed[1].dealerDiscount, 0);
  assert.equal(parsed[1].msrp, 48000);
});

test("the Ford export table matches the on-screen comparison", () => {
  const table = api.NIP_exportTable_({
    home: "https://www.geauxforddenhamsprings.com",
    pulledAt: "2026-09-26T18:00:00.000Z",
    dealers: [
      { id: "geauxforddenhamsprings.com", name: "Geaux Ford", website: "https://www.geauxforddenhamsprings.com" },
      { id: "hollingsworthrichardsford.com", name: "Hollingsworth Richards Ford", website: "https://www.hollingsworthrichardsford.com" },
      { id: "bayouford.net", name: "Bayou Ford", website: "https://www.bayouford.net" },
    ],
    rows: [
      {
        year: "2026",
        make: "Ford",
        model: "F-150",
        trim: "XLT",
        home: {
          name: "Geaux Ford",
          count: 2,
          avgDiscount: 1500,
          avgPercent: 2.5,
          units: [{ stock: "G1", vin: "VIN1", dealerDiscount: 2000, discountPercent: 3.3 }],
        },
        competitors: [
          { id: "hollingsworthrichardsford.com", name: "Hollingsworth Richards Ford", count: 1, avgDiscount: 4500, units: [{ stock: "H1", vin: "VIN2", dealerDiscount: 4500, discountPercent: 8 }] },
          { id: "bayouford.net", name: "Bayou Ford", count: 0 },
        ],
      },
      {
        year: "2026",
        make: "Ford",
        model: "Explorer",
        trim: "XLT",
        home: { name: "Geaux Ford", count: 1, avgDiscount: 4000, avgPercent: 8, units: [] },
        competitors: [
          { id: "hollingsworthrichardsford.com", name: "Hollingsworth Richards Ford", count: 1, avgDiscount: 2500, units: [] },
          { id: "bayouford.net", name: "Bayou Ford", count: 0 },
        ],
      },
    ],
  });
  assert.deepEqual(table.headers, ["Year", "Make", "Model", "Trim", "Geaux n", "Geaux $", "Geaux %", "HR $", "BY $", "Leader", "Gap"]);
  assert.equal(table.fileName, "Geaux-Ford-Discount-Position-2026-09-26");
  assert.equal(table.title, "Geaux Discount Position");
  assert.equal(table.rows[0][7], "$4,500 (1)");
  assert.equal(table.rows[0][8], "NO STOCK");
  assert.equal(table.rows[0][9], "HR");
  assert.equal(table.rows[0][10], "$3,000");
  assert.equal(table.rows[1][10], "+$1,500");
  assert.equal(table.details[0][0], "Geaux Ford");
  assert.deepEqual(api.NIP_exportTable_({}).rows, []);
});

test("Ford rows still require Geaux stock", () => {
  const home = { id: "geauxforddenhamsprings.com", name: "Geaux Ford" };
  const other = { id: "bayouford.net", name: "Bayou Ford" };
  const rows = api.NIP_rows_(home, [home, other], [
    { dealerId: home.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "A", stock: "1", msrp: 55000, dealerDiscount: 0 },
    { dealerId: other.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "B", stock: "2", msrp: 56000, dealerDiscount: 2500 },
    { dealerId: other.id, year: "2027", make: "Ford", model: "F-150", trim: "XLT", vin: "C", stock: "3", msrp: 58000, dealerDiscount: 3000 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, "2026");
  assert.equal(rows[0].home.avgDiscount, 0);
  assert.equal(rows[0].competitors[0].gap, 2500);
});
