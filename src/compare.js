import { average, discountPercent, vehicleKey, vehicleLabel } from "./pricing.js";

function summarize(units) {
  const discounts = units.map((unit) => unit.dealerDiscount);
  const percents = units
    .map((unit) => unit.discountPercent)
    .filter((n) => n != null);
  const avgDiscount = average(discounts);
  return {
    count: units.length,
    avgDiscount,
    avgPercent: percents.length ? Math.round((percents.reduce((s, n) => s + n, 0) / percents.length) * 10) / 10 : null,
    units: [...units].sort((a, b) => b.dealerDiscount - a.dealerDiscount || String(a.stock).localeCompare(String(b.stock))),
  };
}

export function compareDealers({ home, dealers, vehicles }) {
  const groups = new Map();
  for (const vehicle of vehicles) {
    if (!vehicle.year || !vehicle.make || !vehicle.model || !vehicle.trim) continue;
    if (vehicle.dealerDiscount == null) continue;
    const key = vehicleKey(vehicle);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: vehicleLabel(vehicle),
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        byDealer: {},
      });
    }
    const group = groups.get(key);
    if (!group.byDealer[vehicle.dealerId]) group.byDealer[vehicle.dealerId] = [];
    group.byDealer[vehicle.dealerId].push(vehicle);
    if (vehicle.dealerId === home.id && vehicle.label) group.label = vehicleLabel(vehicle);
  }

  const rows = [];
  for (const group of groups.values()) {
    const homeUnits = group.byDealer[home.id] || [];
    if (!homeUnits.length) continue;
    const homeSummary = summarize(homeUnits);
    const baseline = homeSummary.avgDiscount;
    const competitors = dealers
      .filter((dealer) => dealer.id !== home.id)
      .map((dealer) => {
        const units = group.byDealer[dealer.id] || [];
        if (!units.length) return { id: dealer.id, name: dealer.name, count: 0, avgDiscount: null, avgPercent: null, gap: null, units: [] };
        const summary = summarize(units);
        return {
          id: dealer.id,
          name: dealer.name,
          ...summary,
          gap: summary.avgDiscount - baseline,
        };
      });
    const matched = competitors.filter((dealer) => dealer.count > 0 && dealer.gap != null);
    if (!matched.length) continue;
    const widest = matched.reduce((best, dealer) => (dealer.gap > best.gap ? dealer : best), matched[0] || { gap: 0 });
    rows.push({
      key: group.key,
      label: group.label,
      year: group.year,
      make: group.make,
      model: group.model,
      trim: group.trim,
      home: { id: home.id, name: home.name, ...homeSummary },
      competitors,
      widestGap: widest.gap,
    });
  }

  rows.sort((a, b) => b.home.count - a.home.count || a.label.localeCompare(b.label));
  return rows;
}

export function attachDiscount(vehicle) {
  const discountPercentValue = discountPercent(vehicle.dealerDiscount, vehicle.msrp);
  return { ...vehicle, discountPercent: discountPercentValue };
}
