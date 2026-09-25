const DRIVETRAIN = /\b(4x4|4x2|4wd|2wd|awd|fwd|rwd|four[\s-]?wheel drive|rear[\s-]?wheel drive|front[\s-]?wheel drive|all[\s-]?wheel drive)\b/gi;
const CAB = /\b(crew cab|double cab|regular cab|extended cab|quad cab|mega cab|supercrew|supercab|king cab|access cab|club cab)\b/gi;
const BOX = /\b(\d{1,2}\s*'\s*\d{0,2}"?\s*box|\d{1,2}\s*ft\.?\s*box|short box|long box|standard box)\b/gi;

const TRIM_ALIASES = [
  [/^(wt|work truck)$/i, "work truck"],
  [/^(big horn|lone star|big horn\/lone star)$/i, "big horn"],
];

export function money(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(Math.abs(n)) : null;
}

export function normalizeTrim(trim) {
  let text = String(trim || "")
    .replace(DRIVETRAIN, " ")
    .replace(CAB, " ")
    .replace(BOX, " ")
    .replace(/[®™]/g, "")
    .replace(/\b(srw|drw|super duty)\b/gi, " ")
    .replace(/[|/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  for (const [pattern, alias] of TRIM_ALIASES) {
    if (pattern.test(text)) text = alias;
  }
  return text;
}

export function normalizeName(value) {
  return String(value || "")
    .replace(/[®™]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeModel(model) {
  let text = normalizeName(model).replace(/\b(srw|drw|super duty)\b/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/\bf\s*(\d{3})(?:\s*sd)?\b/g, "f-$1");
  return text.replace(/\s+/g, " ").trim();
}

export function vehicleKey(vehicle) {
  return [
    String(vehicle.year || "").trim(),
    normalizeName(vehicle.make),
    normalizeModel(vehicle.model),
    normalizeTrim(vehicle.trim),
  ].join("|");
}

export function vehicleLabel(vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isStoreSavingsLine(className, label) {
  const cls = String(className || "");
  const text = String(label || "").replace(/\s+/g, " ").trim();
  if (/incentive-|consumer-cash|bonus-cash|dealer-fee|left-discounts/i.test(cls)) return false;
  if (/^msrp$|total savings|sales price|selling price|internet price|documentation|doc fee|notary|title fee/i.test(text)) return false;
  if (/customer cash|bonus cash|rebate|military|first responder|college|lease loyalty|conquest/i.test(text)) return false;
  return /dealer-incentive|dealer-discount/i.test(cls) || /(^|\s)discounts(\s|$)/i.test(cls) || /(^|\s)subtract(\s|$)/i.test(cls);
}

export function classifyPriceBlocks(blocks) {
  let dealerDiscount = 0;
  let rebates = 0;
  let msrp = null;
  let sawDealerLine = false;
  for (const block of blocks || []) {
    const cls = String(block.className || "");
    const label = String(block.label || "").replace(/\s+/g, " ").trim();
    const amount = money(block.amount);
    if (/^msrp$/i.test(label) && amount != null) msrp = amount;
    if (amount == null) continue;
    const dealerLine = isStoreSavingsLine(cls, label);
    const rebateLine =
      !dealerLine &&
      (/incentive-|rebate/i.test(cls) ||
        /customer cash|bonus cash|rebate|military|first responder|manufacturer/i.test(label));
    if (dealerLine) {
      dealerDiscount += amount;
      sawDealerLine = true;
    } else if (rebateLine) {
      rebates += amount;
    }
  }
  return { dealerDiscount, rebates, msrp, sawDealerLine };
}

export function priceFromHtml(html) {
  const source = String(html || "");
  let dealerDiscount = 0;
  let msrp = null;
  let sawDealerLine = false;
  const inspire = /class="([^"]*price-block[^"]*)"[\s\S]{0,700}?class="price-label"[^>]*>([\s\S]*?)<\/span>[\s\S]{0,300}?class="price"[^>]*>([\s\S]*?)<\/span>/gi;
  const seenLines = new Set();
  let match;
  while ((match = inspire.exec(source))) {
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const amount = money(match[3].replace(/<[^>]+>/g, " "));
    if (/^msrp$/i.test(label) && amount != null && msrp == null) msrp = amount;
    const lineKey = label.toLowerCase();
    if (amount == null || seenLines.has(lineKey)) continue;
    seenLines.add(lineKey);
    if (isStoreSavingsLine(match[1], label)) {
      dealerDiscount += amount;
      sawDealerLine = true;
    }
  }
  const dealeron = /priceBloc[k]?ItemPriceLabel[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]{0,1200}?priceBloc[k]?ItemPriceValue[^>]*>\s*([^<]+)/gi;
  let internetPrice = null;
  while ((match = dealeron.exec(source))) {
    const label = match[1].replace(/\s+/g, " ").replace(/:$/, "").trim();
    const amount = money(match[2]);
    if (/^msrp$/i.test(label) && amount != null && msrp == null) msrp = amount;
    if (/^internet price$/i.test(label) && amount != null && internetPrice == null) internetPrice = amount;
    const lineKey = label.toLowerCase();
    if (amount == null || seenLines.has(lineKey)) continue;
    seenLines.add(lineKey);
    if (isStoreSavingsLine("priceBlockItem", label)) {
      dealerDiscount += amount;
      sawDealerLine = true;
    }
  }
  const msrpRow = /class="amount msrp"[^>]*>\s*([^<]+)/i.exec(source);
  if (msrp == null && msrpRow) msrp = money(msrpRow[1]);
  const discountRow = /class="price-row discount"[^>]*>[\s\S]{0,500}?class="amount discount"[^>]*>\s*([^<]+)/i.exec(source);
  if (!sawDealerLine && discountRow) {
    const amount = money(discountRow[1]);
    if (amount != null) {
      dealerDiscount = amount;
      sawDealerLine = true;
    }
  }
  if (!sawDealerLine && msrp != null && internetPrice != null && msrp > internetPrice) {
    dealerDiscount = msrp - internetPrice;
    sawDealerLine = true;
  }
  return { dealerDiscount, msrp, sawDealerLine };
}

export function discountPercent(discount, msrp) {
  if (!msrp) return null;
  return Math.round((discount / msrp) * 1000) / 10;
}

export function average(numbers) {
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}
