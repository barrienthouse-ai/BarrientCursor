import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory pricing adds a sheet menu without a second onOpen", () => {
  const menu = readFileSync(new URL("../apps-script/NIP_Menu.gs", import.meta.url), "utf8");
  const api = readFileSync(new URL("../apps-script/NIP_Api.gs", import.meta.url), "utf8");
  const code = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
  assert.match(code, /\{ title: 'New Inventory Pricing', onOpen: 'NIP_onOpen' \}/);
  assert.equal(code.split("\n").filter((line) => line.startsWith("function onOpen(")).length, 1);
  assert.match(menu, /function NIP_onOpen\(/);
  assert.match(menu, /function NIP_open\(/);
  assert.match(menu, /showModalDialog/);
  assert.doesNotMatch(menu, /function onOpen\(/);
  assert.doesNotMatch(api, /function onOpen\(/);
  assert.doesNotMatch(api, /DEALINPUT/);
  assert.match(api, /dealer-incentive\|dealer-discount/);
});
