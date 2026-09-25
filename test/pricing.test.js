import assert from "node:assert/strict";
import test from "node:test";
import { attachDiscount, compareDealers } from "../src/compare.js";
import { classifyPriceBlocks, normalizeTrim, priceFromHtml, vehicleKey } from "../src/pricing.js";

test("the dealer row counts no matter what the store named it", () => {
  const priced = classifyPriceBlocks([
    { className: "price-block", label: "MSRP", amount: "$67,145" },
    { className: "price-block dealer-incentive subtract", label: "Weekend Blowout", amount: "$7,000" },
    { className: "price-block incentive-bonus-cash", label: "Bonus Cash", amount: "$3,500" },
    { className: "price-block left-discounts", label: "Total Savings", amount: "$11,500" },
    { className: "price-block", label: "Geaux Summer Savings", amount: "$4,000" },
  ]);
  assert.equal(priced.dealerDiscount, 7000);
  assert.equal(priced.rebates, 3500);
});

test("Geaux Summer Savings counts when MSRP is wrapped in extra tags", () => {
  const html = `
    <div class="price-block left-discounts"><span class="price-label"><strong>Total Savings</strong></span><span class="price"><strong>$1,000</strong></span></div>
    <div class="price-block "><span class="price-label">MSRP</span><span class="price"><span style="color:#dd3333"><del>$37,215</del></span></span></div>
    <div class="price-block dealer-incentive subtract"><span class="price-label">Geaux Summer Savings</span><span class="price">$1,000</span></div>
  `;
  const priced = priceFromHtml(html);
  assert.equal(priced.msrp, 37215);
  assert.equal(priced.dealerDiscount, 1000);
  const withPlain = priceFromHtml(html + `<div class="price-block "><span class="price-label">Savings</span><span class="price">$521</span></div>`);
  assert.equal(withPlain.dealerDiscount, 1000);
});

test("DealerOn Supreme Savings is the dealer line and the SAVINGS headline is not", () => {
  const html = `
    <div class="vehiclePricingHighlight dealerDiscount">
      <span class="vehiclePricingHighlightAmount">$13,000</span>
      <span class="vehiclePricingHighlightLabel">SAVINGS</span>
    </div>
    <span class="priceBlocItemPriceLabel">MSRP:</span><span class="priceBlocItemPriceValue">$66,090</span>
    <span class="priceBlocItemPriceLabel">Store Event:</span><span class="priceBlocItemPriceValue">-$7,000</span>
    <span class="priceBlocItemPriceLabel">Internet Price:</span><span class="priceBlocItemPriceValue">$59,090</span>
    <span class="priceBlocItemPriceLabel">Internet Price:</span><span class="priceBlocItemPriceValue">$59,090</span>
    <span class="priceBlockItemRebate">Customer Cash</span>
  `;
  const priced = priceFromHtml(html);
  assert.equal(priced.dealerDiscount, 7000);
  assert.equal(priced.msrp, 66090);
  assert.equal(priced.sawDealerLine, true);
});

test("Bill Hood's unnamed discount and Bayou Ford's dealer discount line both count", () => {
  const hood = priceFromHtml(`
    <span class="priceBlocItemPriceLabel">MSRP:</span><span class="priceBlocItemPriceValue">$55,375</span>
    <span class="priceBlocItemPriceLabel">Documentation Fee:</span><span class="priceBlocItemPriceValue">$436</span>
    <span class="priceBlocItemPriceLabel">Hood Ford Price</span><span class="priceBlocItemPriceValue">$50,811</span>
  `);
  assert.equal(hood.dealerDiscount, 5000);
  const bayou = priceFromHtml(`
    <span class="priceBlocItemPriceLabel">Retail Value</span><span class="priceBlocItemPriceValue">$67,890</span>
    <span class="priceBlocItemPriceLabel">Dealer Discount</span><span class="priceBlocItemPriceValue">-$7,000</span>
    <span class="priceBlocItemPriceLabel">Bayou Price</span><span class="priceBlocItemPriceValue">$63,359</span>
  `);
  assert.equal(bayou.dealerDiscount, 7000);
});

test("Hollingsworth subtract row and Robinson discount row are the dealer discount", () => {
  const hollingsworth = priceFromHtml(`
    <div class="price-block "><span class="price-label">MSRP</span><span class="price">$66,625</span></div>
    <div class="price-block subtract"><span class="price-label">Dealer Discount</span><span class="price">$7,520</span></div>
    <div class="incentives cash-incentives-breakdown subtract"><div class="price-block"><span class="price-label">Retail Customer Cash</span><span class="price">$3,000</span></div></div>
  `);
  assert.equal(hollingsworth.dealerDiscount, 7520);
  const robinson = priceFromHtml(`
    <div class="price-row msrp"><div class="label msrp">MSRP:</div><div class="amount msrp">$58,629</div></div>
    <div class="price-row discount" data-section="discount"><div class="label discount">Robinson Brothers Discount:</div><div class="amount discount">$2,237</div></div>
    <div class="price-row internet-price"><span class="priceBlocItemPriceLabel">Internet Price:</span><span class="priceBlocItemPriceValue">$51,392</span></div>
  `);
  assert.equal(robinson.dealerDiscount, 2237);
  assert.equal(robinson.msrp, 58629);
});

test("a store-named discount line is the dealer discount", () => {
  const priced = classifyPriceBlocks([
    { className: "price-block original", label: "MSRP", amount: "$28,000" },
    { className: "price-block discounts", label: "Banner Discount*", amount: "$1,500" },
    { className: "price-block incentive-bonus-cash subtract", label: "Bonus Cash", amount: "$1,000" },
  ]);
  assert.equal(priced.dealerDiscount, 1500);
  assert.equal(priced.rebates, 1000);
});

test("dealer discount ignores manufacturer rebates", () => {
  const priced = classifyPriceBlocks([
    { className: "price-block", label: "MSRP", amount: "$67,145" },
    { className: "price-block dealer-incentive subtract", label: "2025 CHEVROLET 2500", amount: "$7,000" },
    { className: "price-block incentive-consumer-cash subtract", label: "Customer Cash", amount: "$1,000" },
    { className: "price-block incentive-bonus-cash subtract", label: "Bonus Cash", amount: "$3,500" },
  ]);
  assert.equal(priced.dealerDiscount, 7000);
  assert.equal(priced.rebates, 4500);
  assert.equal(priced.msrp, 67145);
});

test("trim normalization drops cab and drivetrain suffixes", () => {
  assert.equal(normalizeTrim("Custom Crew Cab 4X4"), "custom");
  assert.equal(normalizeTrim("WT"), "work truck");
  assert.equal(vehicleKey({ year: "2026", make: "Chevrolet", model: "Silverado 1500", trim: "LT Trail Boss 4x4" }), "2026|chevrolet|silverado 1500|lt trail boss");
});

test("super duty, srw, and f250 are the same model", () => {
  const home = vehicleKey({ year: "2026", make: "Ford", model: "Super Duty F-250®", trim: "Lariat®" });
  const srw = vehicleKey({ year: "2026", make: "Ford", model: "Super Duty F-250 SRW", trim: "Lariat" });
  const plain = vehicleKey({ year: "2026", make: "Ford", model: "F250", trim: "Lariat" });
  assert.equal(home, plain);
  assert.equal(srw, plain);
});

test("a home unit with no dealer discount stays when a competitor discounts that trim", () => {
  const home = { id: "geauxford.com", name: "Geaux Ford" };
  const other = { id: "hollingsworth.com", name: "Hollingsworth" };
  const vehicles = [
    attachDiscount({ dealerId: home.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "A", stock: "TT14922", msrp: 55935, dealerDiscount: 0 }),
    attachDiscount({ dealerId: other.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "B", stock: "160088", msrp: 66625, dealerDiscount: 7520 }),
    attachDiscount({ dealerId: home.id, year: "2026", make: "Ford", model: "Ranger", trim: "XLT", vin: "C", stock: "TT14667", msrp: 43200, dealerDiscount: 0 }),
  ];
  const rows = compareDealers({ home, dealers: [home, other], vehicles });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "2026 Ford F-150 XLT");
  assert.equal(rows[0].home.avgDiscount, 0);
  assert.equal(rows[0].competitors[0].gap, 7520);
  const ford = { id: "geauxford.com", name: "Geaux Ford" };
  const otherStore = { id: "hollingsworth.com", name: "Hollingsworth" };
  const withoutHome = compareDealers({
    home: { id: "geauxchevrolet.com", name: "Geaux Chevrolet" },
    dealers: [{ id: "geauxchevrolet.com", name: "Geaux Chevrolet" }, ford, otherStore],
    vehicles: [
      attachDiscount({ dealerId: ford.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "A", stock: "TT14922", msrp: 55935, dealerDiscount: 0 }),
      attachDiscount({ dealerId: otherStore.id, year: "2026", make: "Ford", model: "F-150", trim: "XLT", vin: "B", stock: "160088", msrp: 66625, dealerDiscount: 7520 }),
    ],
  });
  assert.equal(withoutHome.length, 0);
});

test("gap is the extra competitor discount on units the home store stocks", () => {
  const home = { id: "geauxchevrolet.com", name: "Geaux" };
  const other = { id: "bannerchevrolet.com", name: "Banner" };
  const vehicles = [
    attachDiscount({ dealerId: home.id, year: "2026", make: "Chevrolet", model: "Equinox", trim: "LT", vin: "A", stock: "1", msrp: 30000, dealerDiscount: 1000 }),
    attachDiscount({ dealerId: other.id, year: "2026", make: "Chevrolet", model: "Equinox", trim: "LT AWD", vin: "B", stock: "9", msrp: 31000, dealerDiscount: 2500 }),
    attachDiscount({ dealerId: other.id, year: "2026", make: "Chevrolet", model: "Trax", trim: "LS", vin: "C", stock: "3", msrp: 25000, dealerDiscount: 4000 }),
  ];
  const rows = compareDealers({ home, dealers: [home, other], vehicles });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].competitors[0].gap, 1500);
  assert.equal(rows[0].competitors[0].units[0].vin, "B");
});
