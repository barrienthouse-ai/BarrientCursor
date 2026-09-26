import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../apps-script/GCY_Api.gs", import.meta.url), "utf8");
const api = new Function(`${source}; return { GCY_key_, GCY_rows_, GCY_origin_, GCY_fromUrl_, GCY_platform_, GCY_dealercomPage_, GCY_exportTable_ };`)();

function key(vehicle) {
  return api.GCY_key_(Object.assign({}, vehicle));
}

test("www.geauxchevy.com scrapes the Chevrolet inventory host", () => {
  assert.equal(api.GCY_origin_("https://www.geauxchevy.com"), "https://www.geauxchevrolet.com");
  assert.equal(api.GCY_origin_("https://www.gerrylanechevy.com"), "https://www.gerrylanechevrolet.com");
  assert.equal(api.GCY_origin_("https://www.supremechevy.com"), "https://www.supremechevy.com");
});

test("the host is read from the page", () => {
  assert.equal(api.GCY_platform_('<script id="dealeron_tagging_data" type="application/json">{"dealerId":"1"}</script>'), "dealeron");
  assert.equal(api.GCY_platform_('accountId:"mattbowerschevymetairie" https://shop.dealer.com/widget.js DDC.WS.state'), "dealer.com");
  assert.equal(api.GCY_platform_('<script>algoliaConfig = {"appId":"ABC"}</script> dealer-inspire'), "inspire");
});

test("Dealer.com keeps the dealer discount and drops manufacturer cash", () => {
  const parsed = api.GCY_dealercomPage_({
    inventory: [
      {
        type: "new",
        year: 2026,
        make: "Chevrolet",
        model: "Silverado 1500",
        trim: "RST",
        vin: "1GTEST00000000001",
        stockNumber: "A1",
        link: "/new/Chevrolet/2026-Chevrolet-Silverado-1500.htm",
        incentiveIds: ["store_customer", "store_sale"],
        pricing: { dprice: [
          { typeClass: "msrp", label: "MSRP", value: "$60,884" },
          { typeClass: "AsubBRule", isDiscount: true, label: "60th Anniversary Sale Savings", value: "$8,000" },
          { typeClass: "documentFee", label: "Dealer Fees", value: "$467" },
          { typeClass: "SICRule", label: "Offers", value: "$4,250" }
        ] }
      },
      {
        type: "new",
        year: 2026,
        make: "Chevrolet",
        model: "Blazer",
        trim: "2LT",
        vin: "1GTEST00000000002",
        incentiveIds: ["mb_event", "mb_military"],
        pricing: { dprice: [
          { typeClass: "msrp", label: "MSRP", value: "$38,815" },
          { typeClass: "invoicePrice", label: "Doc & Convenience Fee", value: "$436" },
          { typeClass: "SICRule", label: "Offers", value: "$5,850" }
        ] }
      }
    ],
    incentives: {
      "[store_customer]": { conditional: false, disclaimer: "Not available with special financing.", specific: { cashOption: 4250 } },
      "[mb_event]": { conditional: false, disclaimer: "Dealer discount off MSRP. Available to Everyone.", specific: { cashOption: 5850 } },
      "[mb_military]": { conditional: true, disclaimer: "Eligible military personnel.", specific: { cashOption: 500 } }
    }
  }, "https://www.example.com");
  assert.equal(parsed[0].dealerDiscount, 8000);
  assert.equal(parsed[0].msrp, 60884);
  assert.equal(parsed[1].dealerDiscount, 5850);
  assert.equal(parsed[1].msrp, 38815);
  assert.equal(key(parsed[1]), "2026|chevrolet|blazer|lt");
});

test("Chevy trims and model lines stay distinct", () => {
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Silverado 1500", trim: "Custom Trail Boss 4x4" }), "2026|chevrolet|silverado 1500|custom trail boss");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Silverado 1500", trim: "LT Trail Boss" }), "2026|chevrolet|silverado 1500|lt trail boss");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Silverado 2500HD", trim: "LT" }), "2026|chevrolet|silverado 2500 hd|lt");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Silverado 1500", trim: "LT" }), "2026|chevrolet|silverado 1500|lt");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Blazer EV", trim: "RS" }), "2026|chevrolet|blazer ev|rs");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Blazer", trim: "RS" }), "2026|chevrolet|blazer|rs");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Equinox EV", trim: "RS" }), "2026|chevrolet|equinox ev|rs");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Corvette Z06", trim: "2LZ" }), "2026|chevrolet|corvette|z06");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Corvette E-Ray", trim: "3LZ" }), "2026|chevrolet|corvette|e-ray");
  assert.equal(key({ year: "2027", make: "Chevrolet", model: "Equinox", trim: "LT" }), "2027|chevrolet|equinox|lt");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Silverado 1500", trim: "1LT" }), "2026|chevrolet|silverado 1500|lt");
  assert.equal(key({ year: "2026", make: "Chevrolet", model: "Blazer", trim: "2LT" }), "2026|chevrolet|blazer|lt");
});

test("Matt Bowers price stack uses the dealer-discount offer, not the doc fee", () => {
  const html = `
    <span class="price-label">MSRP</span></dt><dd class="msrp"><span class="price-value">$38,815</span></dd>
    <span class="price-label">Doc &amp; Convenience Fee</span></dt><dd class="invoicePrice"><span class="price-value">$436</span></dd>
    <span class="price-label">Sale Price</span></dt><dd class="salePrice"><span class="price-value">$39,251</span></dd>
    "shortTitle":"$5,850 Matt's End of September Savings Event","conditional":false,"disclaimer":"Dealer discount off MSRP. Available to Everyone.","specific":{"type":"CASH","cashOption":5850}
    "shortTitle":"$5,850 Matt's End of September Savings Event","conditional":false,"disclaimer":"Dealer discount off MSRP. Available to Everyone.","specific":{"type":"CASH","cashOption":5850}
  `;
  const priced = new Function(`${source}; return GCY_price_;`)()(html);
  assert.equal(priced.msrp, 38815);
  assert.equal(priced.dealerDiscount, 5850);
  assert.equal(priced.sawDealerLine, true);
});

test("a Dealer.com vehicle URL keeps the model and drops the hash", () => {
  const parsed = api.GCY_fromUrl_("https://www.mbchevymetairie.com/new/Chevrolet/2026-Chevrolet-Blazer-EV-2b0e0601ac18066909f1a4a82c3e9719.htm");
  assert.equal(parsed.year, "2026");
  assert.equal(parsed.make, "Chevrolet");
  assert.match(parsed.model, /Blazer EV/i);
  assert.doesNotMatch(parsed.model, /2b0e0601/i);
});

test("rows require Geaux Chevy stock and keep a zero-discount home unit", () => {
  const home = { id: "geauxchevrolet.com", name: "Geaux Chevrolet" };
  const other = { id: "supremechevy.com", name: "Supreme Chevrolet" };
  const rows = api.GCY_rows_(home, [home, other], [
    { dealerId: home.id, year: "2026", make: "Chevrolet", model: "Tahoe", trim: "LT", vin: "A", stock: "1", msrp: 60000, dealerDiscount: 0 },
    { dealerId: other.id, year: "2026", make: "Chevrolet", model: "Tahoe", trim: "LT", vin: "B", stock: "2", msrp: 61000, dealerDiscount: 2500 },
    { dealerId: other.id, year: "2027", make: "Chevrolet", model: "Tahoe", trim: "LT", vin: "C", stock: "3", msrp: 64000, dealerDiscount: 3000 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, "2026");
  assert.equal(rows[0].model, "Tahoe");
  assert.equal(rows[0].home.avgDiscount, 0);
  assert.equal(rows[0].competitors[0].count, 1);
  assert.equal(rows[0].competitors[0].gap, 2500);
});

test("the export table matches the on-screen comparison", () => {
  const table = api.GCY_exportTable_({
    home: "https://www.geauxchevy.com",
    pulledAt: "2026-09-26T15:00:00.000Z",
    dealers: [
      { id: "geauxchevrolet.com", name: "Geaux Chevrolet", website: "https://www.geauxchevy.com" },
      { id: "supremechevy.com", name: "Supreme Chevrolet", website: "https://www.supremechevy.com" },
      { id: "rossdowningchevrolet.com", name: "Ross Downing Chevrolet", website: "https://www.rossdowningchevrolet.com" },
    ],
    rows: [
      {
        year: "2026",
        make: "Chevrolet",
        model: "Tahoe",
        trim: "LT",
        home: {
          name: "Geaux Chevrolet",
          count: 2,
          avgDiscount: 1500,
          avgPercent: 2.5,
          units: [
            { stock: "G1", vin: "VIN1", dealerDiscount: 2000, discountPercent: 3.3 },
            { stock: "G2", vin: "VIN2", dealerDiscount: 1000, discountPercent: 1.7 },
          ],
        },
        competitors: [
          {
            id: "supremechevy.com",
            name: "Supreme Chevrolet",
            count: 1,
            avgDiscount: 4500,
            units: [{ stock: "S1", vin: "VIN3", dealerDiscount: 4500, discountPercent: 7 }],
          },
          { id: "rossdowningchevrolet.com", name: "Ross Downing Chevrolet", count: 0 },
        ],
      },
      {
        year: "2026",
        make: "Chevrolet",
        model: "Blazer",
        trim: "LT",
        home: { name: "Geaux Chevrolet", count: 1, avgDiscount: 4000, avgPercent: 10, units: [{ stock: "G3", vin: "VIN4", dealerDiscount: 4000, discountPercent: 10 }] },
        competitors: [
          { id: "supremechevy.com", name: "Supreme Chevrolet", count: 1, avgDiscount: 2500, units: [{ stock: "S2", vin: "VIN5", dealerDiscount: 2500, discountPercent: 6 }] },
          { id: "rossdowningchevrolet.com", name: "Ross Downing Chevrolet", count: 0 },
        ],
      },
      {
        year: "2027",
        make: "Chevrolet",
        model: "Equinox",
        trim: "LT",
        home: { name: "Geaux Chevrolet", count: 1, avgDiscount: 1000, avgPercent: 3, units: [] },
        competitors: [
          { id: "supremechevy.com", name: "Supreme Chevrolet", count: 0 },
          { id: "rossdowningchevrolet.com", name: "Ross Downing Chevrolet", count: 0 },
        ],
      },
    ],
  });
  assert.deepEqual(table.headers, ["Year", "Make", "Model", "Trim", "Geaux n", "Geaux $", "Geaux %", "SC $", "RD $", "Leader", "Gap"]);
  assert.equal(table.fileName, "Geaux-Chevy-Discount-Position-2026-09-26");
  assert.equal(table.rows[0][5], "$1,500");
  assert.equal(table.rows[0][6], "2.5%");
  assert.equal(table.rows[0][7], "$4,500 (1)");
  assert.equal(table.rows[0][8], "NO STOCK");
  assert.equal(table.rows[0][9], "SC");
  assert.equal(table.rows[0][10], "$3,000");
  assert.equal(table.rows[1][10], "+$1,500");
  assert.equal(table.rows[2][9], "NO STOCK");
  assert.equal(table.rows[2][10], "NO STOCK");
  assert.equal(table.details.length, 5);
  assert.deepEqual(table.details[0], ["Geaux Chevrolet", "2026", "Chevrolet", "Tahoe", "LT", "G1", "VIN1", "$2,000", "3.3%"]);
  assert.equal(table.details[2][0], "Supreme Chevrolet");
  assert.deepEqual(api.GCY_exportTable_({}).rows, []);
});
