var NIP_DRIVETRAIN_ = /\b(4x4|4x2|4wd|2wd|awd|fwd|rwd|four wheel drive|rear wheel drive|front wheel drive|all wheel drive)\b/gi;
var NIP_CAB_ = /\b(crew cab|double cab|regular cab|extended cab|quad cab|mega cab|supercrew|supercab|king cab)\b/gi;

function NIP_compare(payload) {
  var homeUrl = NIP_website_(payload && payload.home);
  var competitors = NIP_unique_((payload && payload.competitors) || []).slice(0, 3);
  if (!homeUrl) throw new Error('Enter your dealership website.');
  if (!competitors.length) throw new Error('Add at least one competitor website.');
  var sites = [homeUrl].concat(competitors);
  var dealers = [];
  var vehicles = [];
  var errors = [];
  for (var i = 0; i < sites.length; i++) {
    try {
      var scraped = NIP_scrapeSite_(sites[i]);
      dealers.push({ id: scraped.id, name: scraped.name, website: sites[i], count: scraped.vehicles.length });
      for (var v = 0; v < scraped.vehicles.length; v++) {
        var vehicle = scraped.vehicles[v];
        vehicle.dealerId = scraped.id;
        vehicle.dealerName = scraped.name;
        vehicle.discountPercent = vehicle.msrp ? Math.round((vehicle.dealerDiscount / vehicle.msrp) * 1000) / 10 : null;
        vehicles.push(vehicle);
      }
    } catch (error) {
      errors.push({ website: sites[i], message: String(error.message || error) });
    }
  }
  var home = null;
  for (var d = 0; d < dealers.length; d++) {
    if (dealers[d].website === homeUrl) home = dealers[d];
  }
  return {
    home: homeUrl,
    dealers: dealers,
    rows: home ? NIP_rows_(home, dealers, vehicles) : [],
    errors: errors,
    pulledAt: new Date().toISOString()
  };
}

function NIP_website_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
  return text.replace(/\/+$/, '');
}

function NIP_unique_(values) {
  var seen = {};
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var site = NIP_website_(values[i]);
    if (!site || seen[site]) continue;
    seen[site] = true;
    out.push(site);
  }
  return out;
}

function NIP_host_(website) {
  return website.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
}

function NIP_origin_(website) {
  var match = String(website).match(/^(https?:\/\/[^\/]+)/i);
  return match ? match[1] : website;
}

function NIP_scrapeSite_(website) {
  var origin = NIP_origin_(website);
  var inventoryUrl = /new-vehicles|new-inventory|searchnew/i.test(website)
    ? String(website).replace(/[?#].*$/, '')
    : origin + '/new-vehicles/';
  var list = NIP_fetch_(inventoryUrl);
  if (NIP_blocked_(list)) throw new Error('The dealer site blocked the inventory request.');
  var name = NIP_storeName_(list, NIP_host_(origin));
  var algolia = NIP_algoliaConfig_(list);
  var cards = algolia ? NIP_algoliaCards_(algolia, origin) : NIP_cards_(list, origin);
  if (!algolia) {
    var page = 2;
    while (page <= 12) {
      var html = NIP_fetch_(inventoryUrl + '?_p=' + page);
      var more = NIP_cards_(html, origin);
      if (!more.length) break;
      var before = cards.length;
      cards = NIP_merge_(cards, more);
      if (cards.length === before) break;
      page++;
    }
  }
  var fresh = [];
  for (var i = 0; i < cards.length; i++) if (/^new$/i.test(cards[i].type || 'New')) fresh.push(cards[i]);
  var vehicles = [];
  for (var start = 0; start < fresh.length; start += 8) {
    var slice = fresh.slice(start, start + 8);
    var responses = UrlFetchApp.fetchAll(slice.map(function (card) {
      return { url: card.href, muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } };
    }));
    for (var r = 0; r < responses.length; r++) {
      var priced = NIP_price_(responses[r].getContentText() || '');
      if (!priced.sawDealerLine || priced.msrp == null) continue;
      vehicles.push({
        vin: slice[r].vin,
        stock: slice[r].stock || '',
        year: String(slice[r].year || ''),
        make: slice[r].make || '',
        model: slice[r].model || '',
        trim: slice[r].trim || '',
        msrp: priced.msrp,
        dealerDiscount: priced.dealerDiscount,
        url: slice[r].href
      });
    }
  }
  if (!vehicles.length) throw new Error('No dealer-discount line was found on new vehicles at ' + inventoryUrl);
  return { id: NIP_host_(origin), name: name, vehicles: vehicles };
}

function NIP_algoliaConfig_(html) {
  var match = String(html).match(/algoliaConfig\s*=\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (error) { return null; }
}

function NIP_algoliaCards_(cfg, origin) {
  var hosts = [
    'https://' + cfg.appId + '-dsn.algolia.net',
    'https://' + String(cfg.appId).toLowerCase() + '-1.algolianet.com',
    'https://' + String(cfg.appId).toLowerCase() + '-2.algolianet.com',
    'https://' + String(cfg.appId).toLowerCase() + '-3.algolianet.com'
  ];
  var lastError = 'Could not read the inventory search index.';
  for (var h = 0; h < hosts.length; h++) {
    try {
      var cards = [];
      for (var page = 0; page < 15; page++) {
        var response = UrlFetchApp.fetch(hosts[h] + '/1/indexes/' + encodeURIComponent(cfg.indexName) + '/query', {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'X-Algolia-Application-Id': cfg.appId,
            'X-Algolia-API-Key': cfg.apiKeySearch
          },
          payload: JSON.stringify({ params: 'hitsPerPage=100&page=' + page + '&filters=type:New' })
        });
        if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
          lastError = 'Inventory search returned ' + response.getResponseCode();
          cards = [];
          break;
        }
        var data = JSON.parse(response.getContentText() || '{}');
        var hits = data.hits || [];
        for (var i = 0; i < hits.length; i++) {
          var hit = hits[i];
          var href = hit.link || hit.url || hit.vdp_url || '';
          if (href && href.indexOf('http') !== 0) href = origin + (href.charAt(0) === '/' ? href : '/' + href);
          if (!hit.vin || !href) continue;
          cards.push({
            vin: hit.vin,
            stock: hit.stock || hit.stock_number || '',
            year: hit.year,
            make: hit.make,
            model: hit.model,
            trim: hit.trim,
            type: hit.type || 'New',
            href: href
          });
        }
        if (!hits.length || page + 1 >= (data.nbPages || 1)) return cards;
      }
      if (cards.length) return cards;
    } catch (error) {
      lastError = String(error.message || error);
    }
  }
  throw new Error(lastError);
}

function NIP_fetch_(url) {
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  return response.getContentText() || '';
}

function NIP_blocked_(html) {
  return /sorry, you have been blocked|just a moment/i.test(String(html).slice(0, 500));
}

function NIP_storeName_(html, fallback) {
  var match = String(html).match(/property="og:site_name"\s+content="([^"]+)"/i) || String(html).match(/<title>([^<|]+)/i);
  return match ? match[1].trim() : fallback;
}

function NIP_cards_(html, origin) {
  var cards = [];
  var re = /data-vehicle="([^"]+)"([\s\S]{0,900}?)href="([^"]+)"/g;
  var match;
  while ((match = re.exec(html))) {
    var data;
    try { data = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { continue; }
    if (!data.vin) continue;
    var href = match[3];
    if (href.indexOf('http') !== 0) href = origin + href;
    cards.push({
      vin: data.vin,
      stock: data.stock || '',
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
      type: data.type || 'New',
      href: href
    });
  }
  return cards;
}

function NIP_merge_(left, right) {
  var seen = {};
  var out = left.slice();
  for (var i = 0; i < left.length; i++) seen[left[i].vin] = true;
  for (var j = 0; j < right.length; j++) {
    if (seen[right[j].vin]) continue;
    seen[right[j].vin] = true;
    out.push(right[j]);
  }
  return out;
}

function NIP_price_(html) {
  var dealerDiscount = 0;
  var msrp = null;
  var sawDealerLine = false;
  var re = /<div[^>]*class="([^"]*price-block[^"]*)"[^>]*>[\s\S]*?class="price-label"[^>]*>([^<]*)[\s\S]*?class="price"[^>]*>([^<]+)/gi;
  var match;
  while ((match = re.exec(html))) {
    var cls = match[1];
    var label = match[2].replace(/\s+/g, ' ').trim();
    var amount = Math.round(Math.abs(Number(String(match[3]).replace(/[^0-9.-]/g, '')) || 0));
    if (/^msrp$/i.test(label)) msrp = amount;
    if (/dealer-incentive|dealer-discount|\bdiscounts\b/i.test(cls) || (/discount/i.test(label) && !/cash|rebate/i.test(label))) {
      dealerDiscount += amount;
      sawDealerLine = true;
    }
  }
  return { dealerDiscount: dealerDiscount, msrp: msrp, sawDealerLine: sawDealerLine };
}

function NIP_trim_(trim) {
  var text = String(trim || '').replace(NIP_DRIVETRAIN_, ' ').replace(NIP_CAB_, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (text === 'wt' || text === 'work truck') return 'work truck';
  return text;
}

function NIP_key_(vehicle) {
  return [vehicle.year, String(vehicle.make || '').toLowerCase(), String(vehicle.model || '').toLowerCase(), NIP_trim_(vehicle.trim)].join('|');
}

function NIP_rows_(home, dealers, vehicles) {
  var groups = {};
  for (var i = 0; i < vehicles.length; i++) {
    var vehicle = vehicles[i];
    if (!vehicle.year || !vehicle.make || !vehicle.model || !vehicle.trim || vehicle.dealerDiscount == null) continue;
    var key = NIP_key_(vehicle);
    if (!groups[key]) groups[key] = { label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].join(' '), by: {} };
    if (!groups[key].by[vehicle.dealerId]) groups[key].by[vehicle.dealerId] = [];
    groups[key].by[vehicle.dealerId].push(vehicle);
    if (vehicle.dealerId === home.id) groups[key].label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].join(' ');
  }
  var rows = [];
  for (var key in groups) {
    var homeUnits = groups[key].by[home.id] || [];
    if (!homeUnits.length) continue;
    var homeAvg = NIP_avg_(homeUnits);
    var competitors = [];
    var widest = null;
    for (var d = 0; d < dealers.length; d++) {
      if (dealers[d].id === home.id) continue;
      var units = (groups[key].by[dealers[d].id] || []).sort(function (a, b) { return b.dealerDiscount - a.dealerDiscount; });
      if (!units.length) {
        competitors.push({ id: dealers[d].id, name: dealers[d].name, count: 0 });
        continue;
      }
      var avg = NIP_avg_(units);
      var gap = avg - homeAvg;
      if (widest == null || gap > widest) widest = gap;
      competitors.push({ id: dealers[d].id, name: dealers[d].name, count: units.length, avgDiscount: avg, avgPercent: NIP_avgPercent_(units), gap: gap, units: units });
    }
    if (widest == null) continue;
    homeUnits.sort(function (a, b) { return b.dealerDiscount - a.dealerDiscount; });
    rows.push({
      label: groups[key].label,
      widestGap: widest,
      home: { id: home.id, name: home.name, count: homeUnits.length, avgDiscount: homeAvg, avgPercent: NIP_avgPercent_(homeUnits), units: homeUnits },
      competitors: competitors
    });
  }
  rows.sort(function (a, b) { return b.widestGap - a.widestGap; });
  return rows;
}

function NIP_avg_(units) {
  var sum = 0;
  for (var i = 0; i < units.length; i++) sum += units[i].dealerDiscount;
  return Math.round(sum / units.length);
}

function NIP_avgPercent_(units) {
  var sum = 0;
  var count = 0;
  for (var i = 0; i < units.length; i++) {
    if (units[i].discountPercent == null) continue;
    sum += units[i].discountPercent;
    count++;
  }
  return count ? Math.round((sum / count) * 10) / 10 : null;
}
