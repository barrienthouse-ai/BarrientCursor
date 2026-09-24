import assert from "node:assert/strict";
import test from "node:test";
import { attachDiscount, compareDealers } from "../src/compare.js";
import { classifyPriceBlocks, normalizeTrim, vehicleKey } from "../src/pricing.js";

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
