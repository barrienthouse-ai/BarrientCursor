import { classifyPriceBlocks, money } from "./pricing.js";
import { withPage } from "./browser.js";

function originOf(input) {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withScheme);
  return url.origin;
}

export function dealerNameFromHost(hostname) {
  return hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
}


async function waitForReady(page, hostname) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await page.evaluate(`({
      title: document.title,
      href: location.href,
      text: document.body ? document.body.innerText.slice(0, 180) : ""
    })`);
    const onHost = state?.href?.includes(hostname);
    const challenged = /just a moment|attention required|sorry, you have been blocked/i.test(`${state?.title || ""} ${state?.text || ""}`);
    const ready = await page.evaluate(`document.querySelectorAll("[data-vehicle]").length`);
    if (onHost && !challenged && ready > 0) return state;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${hostname} to load.`);
}

export async function scrapeDealer(website, onProgress, options = {}) {
  const origin = originOf(website);
  const startUrl = `${origin}/new-vehicles/`;
  onProgress?.(`Opening ${startUrl}`);
  return withPage(async (page) => {
    await page.navigate(startUrl);
    let state = await waitForReady(page, new URL(startUrl).hostname);
    if (/sorry, you have been blocked/i.test(state.title || "")) {
      throw new Error("The dealer site blocked the inventory request.");
    }
    const inventoryLink = await page.evaluate(`(() => {
      if (/new-vehicles|new-inventory|searchnew/i.test(location.pathname)) return location.href;
      const link = [...document.querySelectorAll("a")].find((anchor) => /new-vehicles|new-inventory|searchnew|new vehicles/i.test(anchor.href + " " + anchor.textContent));
      return link ? link.href : "";
    })()`);
    if (!inventoryLink) throw new Error("No new-vehicle inventory link was found on that site.");
    if (inventoryLink !== state.href) {
      onProgress?.(`Opening inventory at ${inventoryLink}`);
      await page.navigate(inventoryLink);
      state = await waitForReady(page, new URL(startUrl).hostname);
    }
    onProgress?.(`Reading new inventory at ${origin}`);
    const listings = [];
    const seen = new Set();
    let inventoryUrl = state.href;
    let scrapedStore = "Dealer";
    for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
      const batch = await page.evaluate(`(() => {
        const storeName = (document.querySelector("meta[property='og:site_name']")?.content || document.title.split("|").pop() || location.hostname).trim();
        return {
          storeName,
          href: location.href,
          cards: [...document.querySelectorAll("[data-vehicle]")].map((card) => {
            let data = {};
            try { data = JSON.parse(card.getAttribute("data-vehicle")); } catch { return null; }
            const link = card.querySelector("a[href*='/inventory/'], a.hit-link");
            return { data, href: link ? link.href : "" };
          }).filter(Boolean)
        };
      })()`);
      let added = 0;
      for (const card of batch.cards || []) {
        const data = card.data || {};
        if (!/^new$/i.test(String(data.type || "New")) || !data.vin || seen.has(data.vin)) continue;
        seen.add(data.vin);
        added += 1;
        listings.push({
          vin: data.vin,
          stock: data.stock || "",
          year: String(data.year || ""),
          make: data.make || "",
          model: data.model || "",
          trim: data.trim || "",
          msrp: data.msrp ?? null,
          href: card.href,
        });
      }
      inventoryUrl = batch.href || inventoryUrl;
      scrapedStore = batch.storeName || scrapedStore;
      const nextUrl = new URL(inventoryUrl, origin);
      nextUrl.searchParams.set("_p", String(pageNumber + 1));
      if (!added) break;
      if (options.limit && listings.length >= options.limit) break;
      await page.navigate(nextUrl.href);
      try {
        await waitForReady(page, new URL(origin).hostname);
      } catch {
        break;
      }
    }
    const scraped = { storeName: scrapedStore, inventoryUrl, vehicles: listings.slice(0, options.limit || listings.length) };
    const pricedVehicles = await page.evaluate(`(async (vehicles) => {
      const queue = vehicles.filter((vehicle) => vehicle.href);
      let cursor = 0;
      async function worker() {
        while (cursor < queue.length) {
          const vehicle = queue[cursor];
          cursor += 1;
          const response = await fetch(vehicle.href, { credentials: "include" });
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          vehicle.blocks = [...doc.querySelectorAll(".price-block")].map((block) => ({
            className: block.className || "",
            label: block.querySelector(".price-label")?.textContent || "",
            amount: block.querySelector(".price")?.textContent || "",
          }));
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker));
      return queue;
    })(${JSON.stringify(scraped.vehicles)})`);
    scraped.vehicles = pricedVehicles;
    if (!scraped || scraped.error) {
      throw new Error(scraped?.error || `Could not read inventory for ${origin}`);
    }
    const vehicles = [];
    for (const vehicle of scraped.vehicles || []) {
      const priced = classifyPriceBlocks(vehicle.blocks || []);
      const msrp = priced.msrp || money(vehicle.msrp);
      if (!priced.sawDealerLine || msrp == null) continue;
      vehicles.push({
        vin: vehicle.vin,
        stock: vehicle.stock || "",
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        msrp,
        dealerDiscount: priced.dealerDiscount,
        rebates: priced.rebates,
        url: vehicle.href,
      });
    }
    onProgress?.(`${scraped.storeName}: ${vehicles.length} new vehicles with a dealer discount line`);
    return {
      name: scraped.storeName,
      origin,
      inventoryUrl: scraped.inventoryUrl,
      vehicles,
    };
  });
}
