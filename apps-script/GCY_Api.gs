var GCY_DRIVETRAIN_ = /\b(4x4|4x2|4wd|2wd|awd|fwd|rwd|four wheel drive|rear wheel drive|front wheel drive|all wheel drive)\b/gi;
var GCY_CAB_ = /\b(crew cab|double cab|regular cab|extended cab|quad cab|mega cab|supercrew|supercab|king cab)\b/gi;
var GCY_BODY_ = /\b(advanced with automatic on demand engagement|with part time selectable engagement|part time selectable engagement|automatic on demand engagement|advanced with|on demand|selectable engagement|part time|full time|4 door|2 door|four door|two door|fastback|convertible|sport utility|4d|2d|4dr|2dr|regular|advanced|automatic|engagement|with|rocky ridge|black widow|harley davidson|standard)\b/gi;

function GCY_compare(payload) {
  var homeUrl = GCY_website_(payload && payload.home);
  var competitors = GCY_unique_((payload && payload.competitors) || []).slice(0, 5);
  if (!homeUrl) throw new Error('Enter your dealership website.');
  if (!competitors.length) throw new Error('Add at least one competitor website.');
  var sites = [homeUrl].concat(competitors);
  var dealers = [];
  var vehicles = [];
  var errors = [];
  for (var i = 0; i < sites.length; i++) {
    try {
      var scraped = GCY_scrapeSite_(sites[i]);
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
      dealers.push({ id: GCY_host_(sites[i]), name: GCY_host_(sites[i]), website: sites[i], count: 0 });
    }
  }
  var home = null;
  for (var d = 0; d < dealers.length; d++) {
    if (dealers[d].website === homeUrl) home = dealers[d];
  }
  return {
    home: homeUrl,
    dealers: dealers,
    rows: home ? GCY_rows_(home, dealers, vehicles) : [],
    errors: errors,
    pulledAt: new Date().toISOString()
  };
}

function GCY_website_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
  return text.replace(/\/+$/, '');
}

function GCY_unique_(values) {
  var seen = {};
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var site = GCY_website_(values[i]);
    if (!site || seen[site]) continue;
    seen[site] = true;
    out.push(site);
  }
  return out;
}

function GCY_host_(website) {
  return website.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
}

function GCY_origin_(website) {
  var match = String(website).match(/^(https?:\/\/[^\/]+)/i);
  var origin = match ? match[1] : website;
  if (/^https?:\/\/(?:www\.)?geauxchevy\.com$/i.test(origin)) return 'https://www.geauxchevrolet.com';
  if (/^https?:\/\/(?:www\.)?gerrylanechevy\.com$/i.test(origin)) return 'https://www.gerrylanechevrolet.com';
  return origin;
}

function GCY_platform_(html) {
  var text = String(html || '');
  if (/dealeron_tagging_data/i.test(text)) return 'dealeron';
  if (/accountId/i.test(text) && (/dealer\.com/i.test(text) || /DDC\.WS/i.test(text) || /websiteProviderId":"ddc"/i.test(text))) return 'dealer.com';
  if (/dealer-inspire|algoliaConfig/i.test(text)) return 'inspire';
  return '';
}

function GCY_dollars_(value) {
  return Math.round(Math.abs(Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, '')) || 0));
}

function GCY_scrapeSite_(website) {
  var origin = GCY_origin_(website);
  var home = GCY_fetch_(origin + '/');
  var platform = GCY_blocked_(home) ? '' : GCY_platform_(home);
  if (!platform) {
    var search = GCY_fetch_(origin + '/searchnew.aspx');
    if (!GCY_blocked_(search) && GCY_platform_(search) === 'dealeron') platform = 'dealeron';
  }
  var name = GCY_storeName_(home, GCY_host_(origin));
  if (platform === 'dealeron') {
    var fed = GCY_dealeronFeed_(origin);
    if (fed.length) return { id: GCY_host_(origin), name: name, vehicles: fed };
  }
  if (platform === 'dealer.com') {
    var listed = GCY_dealercomFeed_(origin, home);
    if (listed.length) return { id: GCY_host_(origin), name: name, vehicles: listed };
  }
  if (!platform && (GCY_blocked_(home) || String(home || '').length < 500)) {
    var recovered = GCY_dealercomFromSitemap_(origin);
    if (recovered.vehicles.length) return { id: GCY_host_(origin), name: recovered.name || name, vehicles: recovered.vehicles };
  }
  if (GCY_blocked_(home)) throw new Error('The dealer site blocked the inventory request.');
  var inventoryUrl = /new-vehicles|new-inventory|searchnew/i.test(website)
    ? String(website).replace(/[?#].*$/, '')
    : origin + '/new-vehicles/';
  var list = GCY_fetch_(inventoryUrl);
  if (GCY_blocked_(list)) throw new Error('The dealer site blocked the inventory request.');
  if (!name || name === GCY_host_(origin)) name = GCY_storeName_(list, GCY_host_(origin));
  var cards = GCY_sitemapCards_(origin);
  if (!cards.length) cards = GCY_dealeronCards_(origin);
  if (!cards.length) cards = GCY_cards_(list, origin);
  if (!cards.length && !/searchnew\.aspx/i.test(inventoryUrl)) {
    var page = 2;
    while (page <= 12) {
      var html = GCY_fetch_(inventoryUrl + '?_p=' + page);
      var more = GCY_cards_(html, origin);
      if (!more.length) break;
      var before = cards.length;
      cards = GCY_merge_(cards, more);
      if (cards.length === before) break;
      page++;
    }
  }
  var dealeron = false;
  for (var c = 0; c < cards.length; c++) {
    if (GCY_isDealeronUrl_(cards[c].href)) { dealeron = true; break; }
  }
  if (dealeron) {
    var fed = GCY_dealeronFeed_(origin);
    if (fed.length) return { id: GCY_host_(origin), name: name, vehicles: fed };
  }
  var fresh = [];
  for (var i = 0; i < cards.length; i++) if (/^new$/i.test(cards[i].type || 'New')) fresh.push(cards[i]);
  var vehicles = [];
  for (var start = 0; start < fresh.length; start += 8) {
    var slice = fresh.slice(start, start + 8);
    var responses = UrlFetchApp.fetchAll(slice.map(function (card) {
      return { url: GCY_fetchUrl_(card.href), muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } };
    }));
    for (var r = 0; r < responses.length; r++) {
      var html = responses[r].getContentText() || '';
      var priced = GCY_price_(html);
      if (priced.msrp == null) continue;
      if (!priced.sawDealerLine) priced.dealerDiscount = 0;
      GCY_fillIdentity_(slice[r], html);
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
  if (!vehicles.length) {
    if (!fresh.length) throw new Error('No new-vehicle list was found at ' + origin + '.');
    throw new Error('No MSRP was found on ' + fresh.length + ' new vehicles at ' + origin + '.');
  }
  return { id: GCY_host_(origin), name: name, vehicles: vehicles };
}

function GCY_algoliaConfig_(html) {
  var match = String(html).match(/algoliaConfig\s*=\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (error) { return null; }
}

function GCY_algoliaCards_(cfg, origin) {
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

function GCY_isDealeronUrl_(url) {
  return /\/new-[a-z][a-z+ ]*-20\d{2}-/i.test(String(url || '')) && !/\/inventory\/new-/i.test(String(url || ''));
}

function GCY_dealeronFeed_(origin) {
  var html = GCY_fetch_(origin + '/searchnew.aspx');
  var tag = (String(html).match(/id="dealeron_tagging_data"[^>]*>(\{[\s\S]*?\})<\/script>/) || [])[1];
  if (!tag) return [];
  var meta;
  try { meta = JSON.parse(tag); } catch (error) { return []; }
  if (!meta.dealerId || !meta.pageId) return [];
  var vehicles = [];
  var seen = {};
  for (var page = 1; page <= 8; page++) {
    var body = GCY_fetch_(origin + '/api/vhcliaa/vehicle-pages/cosmos/srp/vehicles/' + meta.dealerId + '/' + meta.pageId + '?pn=96&pt=' + page);
    var data;
    try { data = JSON.parse(body); } catch (error) { break; }
    var cards = data.DisplayCards || [];
    if (!cards.length) break;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i] && cards[i].VehicleCard;
      if (!card || !/^new$/i.test(card.VehicleType || '') || !card.VehicleVin) continue;
      var vin = String(card.VehicleVin).toUpperCase();
      if (seen[vin]) continue;
      seen[vin] = true;
      var msrp = Math.round(Number(card.VehicleMsrp) || 0);
      if (!msrp) continue;
      var discount = GCY_libraryDiscount_(GCY_decodePrice_(card.VehiclePriceLibrary));
      vehicles.push({
        vin: vin,
        stock: card.VehicleStockNumber || '',
        year: String(card.VehicleYear || ''),
        make: card.VehicleMake || '',
        model: card.VehicleModel || '',
        trim: card.VehicleTrim || '',
        msrp: msrp,
        dealerDiscount: discount == null ? 0 : discount,
        url: card.VehicleDetailUrl || ''
      });
    }
    var total = data.Paging && data.Paging.PaginationDataModel && data.Paging.PaginationDataModel.TotalPages;
    if (!total || page >= total) break;
  }
  return vehicles;
}

function GCY_decodePrice_(encoded) {
  try {
    return Utilities.newBlob(Utilities.base64Decode(String(encoded || ''))).getDataAsString();
  } catch (error) {
    return '';
  }
}

function GCY_libraryDiscount_(text) {
  var parts = String(text || '').split(';');
  for (var i = 0; i < parts.length; i++) {
    var bits = parts[i].split(':');
    if (bits[0] === 'calc_Dealer Discount') return Math.round(Number(bits[1]) || 0);
  }
  return null;
}

function GCY_dealercomAccount_(html) {
  var text = String(html || '');
  var account = (text.match(/accountId["']?\s*[:=]\s*["']([A-Za-z0-9_-]+)/) || [])[1] || '';
  var site = (text.match(/siteId["']?\s*[:=]\s*["']([A-Za-z0-9_-]+)/) || [])[1] || account;
  return { account: account, site: site };
}

function GCY_dealercomDiscount_(vehicle, incentives) {
  var discount = 0;
  var saw = false;
  var rows = vehicle && vehicle.pricing && vehicle.pricing.dprice ? vehicle.pricing.dprice : [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i] || !rows[i].isDiscount) continue;
    var amount = GCY_dollars_(rows[i].value);
    if (!amount) continue;
    discount += amount;
    saw = true;
  }
  var ids = vehicle && vehicle.incentiveIds ? vehicle.incentiveIds : [];
  incentives = incentives || {};
  for (var j = 0; j < ids.length; j++) {
    var inc = incentives[ids[j]] || incentives['[' + ids[j] + ']'];
    if (!inc || inc.conditional) continue;
    if (!/dealer discount/i.test(String(inc.disclaimer || ''))) continue;
    var cash = Math.round(Number(inc.specific && inc.specific.cashOption) || 0);
    if (!cash) continue;
    discount += cash;
    saw = true;
  }
  return { discount: discount, saw: saw };
}

function GCY_dealercomPage_(data, origin) {
  var vehicles = [];
  var list = data && data.inventory ? data.inventory : [];
  var incentives = data && data.incentives ? data.incentives : {};
  for (var i = 0; i < list.length; i++) {
    var card = list[i];
    if (!card || !/^new$/i.test(card.type || card.condition || '')) continue;
    var msrp = null;
    var rows = card.pricing && card.pricing.dprice ? card.pricing.dprice : [];
    for (var r = 0; r < rows.length; r++) {
      var label = String(rows[r].label || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (rows[r].typeClass === 'msrp' || /^msrp$/i.test(label)) msrp = GCY_dollars_(rows[r].value);
    }
    if (!msrp) continue;
    var priced = GCY_dealercomDiscount_(card, incentives);
    var href = String(card.link || '');
    if (href && href.indexOf('http') !== 0) href = origin + href;
    vehicles.push({
      vin: String(card.vin || '').toUpperCase(),
      stock: card.stockNumber || '',
      year: String(card.year || ''),
      make: card.make || '',
      model: card.model || '',
      trim: card.trim || '',
      msrp: msrp,
      dealerDiscount: priced.saw ? priced.discount : 0,
      url: href
    });
  }
  return vehicles;
}

function GCY_dealercomSample_(xml) {
  var urls = String(xml || '').match(/https?:\/\/[^<\s"]+/gi) || [];
  for (var i = 0; i < urls.length; i++) {
    var href = urls[i].replace(/&amp;/g, '&');
    if (/\/new\/[^/]+\/20\d{2}-/i.test(href)) return href;
  }
  return '';
}

function GCY_dealercomFromSitemap_(origin) {
  var xml = GCY_fetch_(origin + '/sitemap.xml');
  var page = GCY_dealercomSample_(xml);
  if (!page) {
    var maps = String(xml).match(/https?:\/\/[^<\s"]+sitemap[^<\s"]*/gi) || [];
    for (var i = 0; i < maps.length && !page; i++) {
      if (!/vehicle/i.test(maps[i])) continue;
      page = GCY_dealercomSample_(GCY_fetch_(maps[i]));
    }
  }
  if (!page) return { name: '', vehicles: [] };
  var html = GCY_fetch_(page);
  if (GCY_platform_(html) !== 'dealer.com') return { name: '', vehicles: [] };
  return { name: GCY_storeName_(html, GCY_host_(origin)), vehicles: GCY_dealercomFeed_(origin, html) };
}

function GCY_dealercomFeed_(origin, homeHtml) {
  var ids = GCY_dealercomAccount_(homeHtml);
  if (!ids.account) return [];
  var vehicles = [];
  var seen = {};
  var start = 0;
  for (var page = 0; page < 12; page++) {
    var payload = {
      siteId: ids.site,
      locale: 'en_US',
      device: 'DESKTOP',
      pageAlias: 'INVENTORY_LISTING_DEFAULT_AUTO_NEW',
      windowId: 'inventory-data-bus1',
      widgetName: 'ws-inv-data',
      includePricing: true,
      inventoryParameters: { inventoryType: 'new', classification: 'new', start: String(start) },
      preferences: { pageSize: '48', 'listing.config.id': 'auto-new' }
    };
    var response = UrlFetchApp.fetch(origin + '/api/widget/ws-inv-data/getInventory', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    var data;
    try { data = JSON.parse(response.getContentText() || ''); } catch (error) { break; }
    var received = data.inventory ? data.inventory.length : 0;
    if (!received) break;
    var batch = GCY_dealercomPage_(data, origin);
    for (var i = 0; i < batch.length; i++) {
      if (!batch[i].vin || seen[batch[i].vin]) continue;
      seen[batch[i].vin] = true;
      vehicles.push(batch[i]);
    }
    var total = data.pageInfo && data.pageInfo.totalCount;
    start += received;
    if (!total || start >= total) break;
  }
  return vehicles;
}

function GCY_fetchUrl_(url) {
  return String(url || '').replace(/%2B/gi, '').replace(/\+/g, '');
}

function GCY_fetch_(url) {
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  return response.getContentText() || '';
}

function GCY_blocked_(html) {
  return /sorry, you have been blocked|just a moment/i.test(String(html).slice(0, 500));
}

function GCY_storeName_(html, fallback) {
  var match = String(html).match(/property="og:site_name"\s+content="([^"]+)"/i) || String(html).match(/<title>([^<|]+)/i);
  return match ? match[1].trim() : fallback;
}

function GCY_cards_(html, origin) {
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

function GCY_merge_(left, right) {
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

function GCY_sitemapCards_(origin) {
  var urls = GCY_newUrls_(GCY_fetch_(origin + '/dealer-inspire-inventory/inventory_sitemap'));
  if (urls.length < 5) {
    var index = GCY_fetch_(origin + '/sitemap_index.xml');
    var maps = String(index).match(/https?:\/\/[^<\s"]+/g) || [];
    for (var i = 0; i < maps.length && urls.length < 5; i++) {
      if (!/inventory/i.test(maps[i])) continue;
      urls = urls.concat(GCY_newUrls_(GCY_fetch_(maps[i])));
    }
  }
  if (urls.length < 5) urls = urls.concat(GCY_newUrls_(GCY_fetch_(origin + '/sitemap.xml')));
  var cards = [];
  var seen = {};
  for (var u = 0; u < urls.length && cards.length < 400; u++) {
    var vinMatch = urls[u].match(/([A-HJ-NPR-Z0-9]{17})\/?$/i);
    var vin = vinMatch ? vinMatch[1].toUpperCase() : '';
    var key = vin || urls[u];
    if (seen[key]) continue;
    seen[key] = true;
    cards.push({ vin: vin, href: urls[u], type: 'New', year: '', make: '', model: '', trim: '', stock: '' });
  }
  return cards;
}

function GCY_newUrls_(xml) {
  var urls = [];
  var matches = String(xml || '').match(/https?:\/\/[^<\s"]+/gi) || [];
  for (var i = 0; i < matches.length; i++) {
    matches[i] = matches[i].replace(/&#x2B;/gi, '+').replace(/&amp;/g, '&');
    var isNew = /\/inventory\/new-|\/new\/[^/]+\/20\d{2}-|\/new-[^/]*20\d{2}-/i.test(matches[i]) && !/\/used-/i.test(matches[i]);
    var isRetail = /\/for-sale\//i.test(matches[i]) && !/\/for-sale\/(?:used|certified)-/i.test(matches[i]) && /20\d{2}-/i.test(matches[i]);
    if (!isNew && !isRetail) continue;
    urls.push(matches[i].replace(/\/$/, '') + '/');
  }
  return urls;
}

function GCY_isStoreSavings_(cls, label) {
  var text = String(label || '').replace(/\s+/g, ' ').trim();
  if (/incentive-|consumer-cash|bonus-cash|dealer-fee|left-discounts/i.test(cls)) return false;
  if (/^msrp$|total savings|sales price|selling price|internet price|documentation|doc fee|notary|title fee/i.test(text)) return false;
  if (/customer cash|bonus cash|rebate|military|first responder|college|lease loyalty|conquest/i.test(text)) return false;
  if (/^dealer discount$/i.test(text)) return true;
  return /dealer-incentive|dealer-discount/i.test(cls) || /(^|\s)discounts(\s|$)/i.test(cls) || /(^|\s)subtract(\s|$)/i.test(cls);
}

function GCY_fromUrl_(url) {
  var path = String(url || '').split('?')[0].replace(/\/+$/, '');
  var slug = decodeURIComponent(path.split('/').pop() || '');
  slug = GCY_clean_(slug).replace(/\b[a-f0-9]{20,}\b/ig, ' ').replace(/\b[A-HJ-NPR-Z0-9]{17}$/i, '').replace(/\s+/g, ' ').trim();
  var year = (slug.match(/\b20\d{2}\b/) || [''])[0];
  if (!year) return null;
  var after = slug.split(year).pop().replace(/\s+/g, ' ').trim();
  var parts = after.split(' ');
  var make = parts.shift() || '';
  if (!/^ford|chevrolet|gmc|lincoln|jeep|ram|dodge|chrysler$/i.test(make)) return null;
  return { year: year, make: make, model: parts.join(' '), trim: '' };
}

function GCY_fillIdentity_(vehicle, html) {
  var fromUrl = GCY_fromUrl_(vehicle.href);
  var title = (String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || String(html).match(/<title>([^<|]+)/i) || [''])[1] || '';
  title = title.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\s+in\s+.*/i, '').replace(/\s+\|.*/, '').replace(/\s+for sale\b.*/i, '').trim();
  var parsed = GCY_parseTitle_(title);
  vehicle.year = (fromUrl && fromUrl.year) || vehicle.year || parsed.year;
  vehicle.make = (fromUrl && fromUrl.make) || vehicle.make || parsed.make;
  var named = [parsed.model, parsed.trim].filter(Boolean).join(' ');
  if (fromUrl && fromUrl.model) {
    var have = GCY_clean_(fromUrl.model).toLowerCase();
    var missing = [];
    var words = GCY_clean_(named).split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w] && have.indexOf(words[w].toLowerCase()) < 0) missing.push(words[w]);
    }
    vehicle.model = missing.length ? fromUrl.model + ' ' + missing.join(' ') : fromUrl.model;
  } else {
    vehicle.model = named || vehicle.model;
  }
  vehicle.trim = '';
  GCY_align_(vehicle);
  if (!vehicle.stock) {
    var stock = (String(html).match(/<title>[^<]*#([A-Z0-9]+)/i) || String(html).match(/data-stock="([A-Z0-9]+)"/i) || [])[1];
    if (stock) vehicle.stock = stock;
  }
}

function GCY_parseTitle_(title) {
  var text = String(title || '').replace(/^new\s+/i, '');
  text = text.replace(GCY_DRIVETRAIN_, ' ').replace(GCY_CAB_, ' ').replace(/\s+/g, ' ').trim();
  var year = (text.match(/20\d{2}/) || [''])[0];
  text = text.replace(year, '').replace(/\s+/g, ' ').trim();
  var parts = text.split(' ');
  var make = parts.length ? parts.shift() : '';
  var rest = parts.join(' ');
  var trims = ['lt trail boss', 'high country', 'trail boss', 'work truck', 'premier', 'activ', 'custom', 'z71', 'zr2', 'rst', 'ltz', 'wt', 'lt', 'ls', 'rs'];
  var lower = rest.toLowerCase();
  var trim = '';
  for (var i = 0; i < trims.length; i++) {
    var needle = trims[i];
    if (lower.length < needle.length) continue;
    if (lower.slice(lower.length - needle.length) !== needle) continue;
    var boundary = lower.length === needle.length || lower.charAt(lower.length - needle.length - 1) === ' ';
    if (!boundary) continue;
    trim = rest.slice(rest.length - needle.length);
    rest = rest.slice(0, rest.length - needle.length).replace(/\s+/g, ' ').trim();
    break;
  }
  if (!trim && rest) {
    var words = rest.split(' ');
    trim = words.pop();
    rest = words.join(' ');
  }
  return { year: year, make: make, model: rest, trim: trim };
}

function GCY_price_(html) {
  var dealerDiscount = 0;
  var msrp = null;
  var sawDealerLine = false;
  var source = String(html || '');
  var re = /class="([^"]*price-block[^"]*)"[\s\S]{0,700}?class="price-label"[^>]*>([\s\S]*?)<\/span>[\s\S]{0,300}?class="price"[^>]*>([\s\S]*?)<\/span>/gi;
  var match;
  var seenLines = {};
  while ((match = re.exec(source))) {
    var label = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    var amount = Math.round(Math.abs(Number(String(match[3]).replace(/<[^>]+>/g, '').replace(/[^0-9.-]/g, '')) || 0));
    if (/^msrp$/i.test(label) && msrp == null) msrp = amount;
    var lineKey = label.toLowerCase();
    if (!amount || seenLines[lineKey]) continue;
    seenLines[lineKey] = true;
    if (GCY_isStoreSavings_(match[1], label)) {
      dealerDiscount += amount;
      sawDealerLine = true;
    }
  }
  var stack = /priceBloc[k]?ItemPriceLabel[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]{0,1200}?priceBloc[k]?ItemPriceValue[^>]*>\s*([^<]+)/gi;
  var internetPrice = null;
  var fees = 0;
  var sellingPrices = [];
  while ((match = stack.exec(source))) {
    var line = match[1].replace(/\s+/g, ' ').replace(/:$/, '').trim();
    var dollars = Math.round(Math.abs(Number(String(match[2]).replace(/[^0-9.-]/g, '')) || 0));
    if (/^msrp$|^retail value$/i.test(line) && msrp == null) msrp = dollars;
    if (/^internet price$/i.test(line) && internetPrice == null) internetPrice = dollars;
    var lineKey = line.toLowerCase();
    if (!dollars || seenLines[lineKey]) continue;
    seenLines[lineKey] = true;
    if (/doc|documentation|notary|title|tag|lien|processing/i.test(line)) fees += dollars;
    else if (!/^msrp$|^retail value$|^internet price$|^price$/i.test(line) && !/accessor/i.test(line)) sellingPrices.push(dollars);
    if (GCY_isStoreSavings_('priceBlockItem', line)) {
      dealerDiscount += dollars;
      sawDealerLine = true;
    }
  }
  if (!sawDealerLine && internetPrice == null && msrp != null && sellingPrices.length === 1) {
    var implied = msrp + fees - sellingPrices[0];
    if (implied > 0) {
      dealerDiscount = implied;
      sawDealerLine = true;
    }
  }
  var msrpRow = /class="amount msrp"[^>]*>\s*([^<]+)/i.exec(source);
  if (msrp == null && msrpRow) msrp = Math.round(Math.abs(Number(String(msrpRow[1]).replace(/[^0-9.-]/g, '')) || 0)) || null;
  var discountRow = /class="price-row discount"[^>]*>[\s\S]{0,500}?class="amount discount"[^>]*>\s*([^<]+)/i.exec(source);
  if (!sawDealerLine && discountRow) {
    var rowAmount = Math.round(Math.abs(Number(String(discountRow[1]).replace(/[^0-9.-]/g, '')) || 0));
    if (rowAmount) {
      dealerDiscount = rowAmount;
      sawDealerLine = true;
    }
  }
  if (!sawDealerLine && msrp != null && internetPrice != null && msrp > internetPrice) {
    dealerDiscount = msrp - internetPrice;
    sawDealerLine = true;
  }
  if (msrp == null) {
    var loose = source.match(/MSRP[^$]{0,80}\$([0-9,]{4,})/i) || source.match(/Retail Value[^$]{0,80}\$([0-9,]{4,})/i);
    if (loose) msrp = Math.round(Number(String(loose[1]).replace(/,/g, '')));
  }
  if (msrp == null) {
    var attr = source.match(/data-msrp="([0-9]{4,})"/i);
    if (attr) msrp = Math.round(Number(attr[1]));
  }
  if (!sawDealerLine) {
    var labeled = /class="price-label"[^>]*>\s*MSRP\s*<\/span><\/dt>\s*<dd[^>]*>\s*(?:<span[^>]*>)?\s*\$?([0-9,]{4,})/i.exec(source);
    if (msrp == null && labeled) msrp = Math.round(Number(String(labeled[1]).replace(/,/g, '')));
    var offerRe = /"shortTitle":"([^"]+)"[\s\S]{0,800}?"conditional":false,"disclaimer":"Dealer discount off MSRP[^"]*"[\s\S]{0,400}?"cashOption":(\d+)/g;
    var offer;
    var seenOffers = {};
    while ((offer = offerRe.exec(source))) {
      var offerKey = offer[1] + '|' + offer[2];
      if (seenOffers[offerKey]) continue;
      seenOffers[offerKey] = true;
      var offerAmount = Math.round(Number(offer[2]) || 0);
      if (!offerAmount) continue;
      dealerDiscount += offerAmount;
      sawDealerLine = true;
    }
  }
  if (!sawDealerLine) {
    var savings = source.match(/dealerDiscount[\s\S]{0,500}?vehiclePricingHighlightAmount[^>]*>\s*\$?([0-9,]{3,})/i);
    if (savings) {
      dealerDiscount = Math.round(Number(String(savings[1]).replace(/,/g, '')));
      sawDealerLine = dealerDiscount > 0;
    }
  }
  return { dealerDiscount: dealerDiscount, msrp: msrp, sawDealerLine: sawDealerLine };
}

function GCY_dealeronCards_(origin) {
  var cards = [];
  var seen = {};
  var url = origin + '/searchnew.aspx';
  for (var page = 0; page < 16 && cards.length < 200; page++) {
    var html = GCY_fetch_(url);
    var block = (String(html).match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"ItemList"[\s\S]*?\})<\/script>/) || [])[1];
    if (!block) break;
    var data;
    try { data = JSON.parse(block); } catch (error) { break; }
    var items = data.itemListElement || [];
    if (!items.length) break;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var href = item.url || '';
      var vin = String(item.identifier || '').toUpperCase();
      if (!vin || !href || seen[vin]) continue;
      seen[vin] = true;
      var named = GCY_parseTitle_(String(item.name || '').replace(/\u002B/g, ' '));
      cards.push({ vin: vin, href: href, type: 'New', year: named.year, make: named.make, model: named.model, trim: named.trim, stock: '' });
    }
    var next = (String(html).match(/rel="next" href="([^"]+)"/i) || [])[1];
    if (!next) break;
    if (next.indexOf('http') !== 0) next = 'https:' + (next.indexOf('//') === 0 ? next : '//' + GCY_host_(origin) + next);
    url = next;
  }
  return cards;
}

function GCY_clean_(value) {
  return String(value || '').replace(/[®™]/g, '').replace(/\+/g, ' ').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function GCY_model_(model) {
  var text = GCY_clean_(model).toLowerCase().replace(/\b(srw|drw|super duty)\b/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\bf\s*(\d{3})(?:\s*sd)?\b/g, 'f-$1');
  return text.replace(/\s+/g, ' ').trim();
}

function GCY_trim_(trim) {
  var text = GCY_clean_(trim).toLowerCase().replace(GCY_DRIVETRAIN_, ' ').replace(GCY_CAB_, ' ').replace(/\b(srw|drw|super duty)\b/g, ' ').replace(/^[123](?=lt$)/, '').replace(/\s+/g, ' ').trim();
  if (text === 'wt' || text === 'work truck') return 'Work Truck';
  if (text === 'st line') return 'ST-Line';
  if (text === 'e ray') return 'E-Ray';
  var codes = { xlt: 'XLT', xl: 'XL', stx: 'STX', st: 'ST', lt: 'LT', ls: 'LS', rs: 'RS', rst: 'RST', ltz: 'LTZ', gt: 'GT', ss: 'SS', z06: 'Z06', zr1: 'ZR1' };
  if (codes[text]) return codes[text];
  if (!text) return '';
  return text.replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
}

function GCY_dedupe_(text) {
  var words = String(text || '').split(/\s+/).filter(Boolean);
  var changed = true;
  while (changed) {
    changed = false;
    for (var size = Math.floor(words.length / 2); size >= 1; size--) {
      for (var i = 0; i + size * 2 <= words.length; i++) {
        var same = true;
        for (var j = 0; j < size; j++) {
          if (words[i + j].toLowerCase() !== words[i + size + j].toLowerCase()) { same = false; break; }
        }
        if (!same) continue;
        words.splice(i + size, size);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return words.join(' ');
}

function GCY_line_(text) {
  var lines = ['silverado 3500 hd', 'silverado 2500 hd', 'silverado 1500', 'silverado ev', 'silverado', 'express cargo', 'express passenger', 'express', 'trailblazer', 'blazer ev', 'blazer', 'equinox ev', 'equinox', 'suburban', 'traverse', 'colorado', 'corvette', 'camaro', 'malibu', 'tahoe', 'trax', 'bolt euv', 'bolt ev', 'bolt'];
  var lower = ' ' + GCY_model_(text) + ' ';
  for (var i = 0; i < lines.length; i++) {
    if (lower.indexOf(' ' + lines[i] + ' ') >= 0) return lines[i];
  }
  return text;
}

function GCY_align_(vehicle) {
  var text = GCY_dedupe_(GCY_clean_((vehicle.model || '') + ' ' + (vehicle.trim || '')));
  text = text.replace(GCY_DRIVETRAIN_, ' ').replace(GCY_CAB_, ' ').replace(GCY_BODY_, ' ').replace(/\b(srw|drw)\b/ig, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\b\d{2,3}a\b/ig, ' ').replace(/\b[123]lt\b/ig, ' LT ').replace(/\b[123]lz\b/ig, ' ').replace(/\b(\d{4})\s*hd\b/ig, '$1 hd').replace(/\b(for sale|suv|crossover|pickup|hatchback|wagon|sedan|premium)\b/ig, ' ').replace(/\s+/g, ' ').trim();
  var trims = ['custom trail boss', 'lt trail boss', 'high country', 'grand sport', 'work truck', 'trail boss', 'stingray', 'e ray', 'premier', 'activ', 'custom', 'z06', 'zr1', 'rst', 'z71', 'zr2', 'ltz', 'wt', 'ss', 'rs', 'lt', 'ls'];
  var trim = '';
  for (var pass = 0; pass < 3; pass++) {
    var lower = ' ' + text.toLowerCase() + ' ';
    var found = '';
    var at = -1;
    var foundEnd = -1;
    for (var i = 0; i < trims.length; i++) {
      var needle = trims[i];
      var spot = lower.lastIndexOf(' ' + needle + ' ');
      if (spot < 0) continue;
      var end = spot + needle.length;
      if (!found || end > foundEnd || (end === foundEnd && needle.length > found.length)) {
        found = needle;
        at = spot;
        foundEnd = end;
      }
    }
    if (!found) break;
    if (!trim) trim = found;
    text = (text.slice(0, Math.max(0, at - 1)) + ' ' + text.slice(at - 1 + found.length + 1)).replace(/\s+/g, ' ').trim();
  }
  text = GCY_line_(text);
  vehicle.model = GCY_model_(text);
  vehicle.trim = GCY_trim_(trim || vehicle.trim);
  if (vehicle.model) {
    var shown = vehicle.model.replace(/\bf-(\d{3})\b/g, function (_, num) { return 'F-' + num; });
    vehicle.model = shown.replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); }).replace(/\bHd\b/g, 'HD').replace(/\bEv\b/g, 'EV');
  }
}

function GCY_key_(vehicle) {
  GCY_align_(vehicle);
  return [vehicle.year, String(vehicle.make || '').toLowerCase(), GCY_model_(vehicle.model), GCY_trim_(vehicle.trim).toLowerCase()].join('|');
}

function GCY_rows_(home, dealers, vehicles) {
  var groups = {};
  for (var i = 0; i < vehicles.length; i++) {
    var vehicle = vehicles[i];
    GCY_align_(vehicle);
    if (!vehicle.year || !vehicle.make || !vehicle.model || !vehicle.trim || vehicle.dealerDiscount == null) continue;
    var key = [vehicle.year, String(vehicle.make || '').toLowerCase(), GCY_model_(vehicle.model), GCY_trim_(vehicle.trim).toLowerCase()].join('|');
    if (!groups[key]) groups[key] = { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].join(' '), by: {} };
    if (!groups[key].by[vehicle.dealerId]) groups[key].by[vehicle.dealerId] = [];
    groups[key].by[vehicle.dealerId].push(vehicle);
    if (vehicle.dealerId === home.id) groups[key].label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].join(' ');
  }
  var rows = [];
  for (var key in groups) {
    var homeUnits = groups[key].by[home.id] || [];
    if (!homeUnits.length) continue;
    var baseline = GCY_avg_(homeUnits);
    var matched = false;
    var competitors = [];
    var widest = null;
    for (var d = 0; d < dealers.length; d++) {
      if (dealers[d].id === home.id) continue;
      var units = (groups[key].by[dealers[d].id] || []).sort(function (a, b) { return b.dealerDiscount - a.dealerDiscount; });
      if (!units.length) {
        competitors.push({ id: dealers[d].id, name: dealers[d].name, count: 0 });
        continue;
      }
      matched = true;
      var avg = GCY_avg_(units);
      var gap = avg - baseline;
      if (gap != null && (widest == null || gap > widest)) widest = gap;
      competitors.push({ id: dealers[d].id, name: dealers[d].name, count: units.length, avgDiscount: avg, avgPercent: GCY_avgPercent_(units), gap: gap, units: units });
    }
    if (!matched && !homeUnits.length) continue;
    homeUnits.sort(function (a, b) { return b.dealerDiscount - a.dealerDiscount; });
    rows.push({
      year: groups[key].year,
      make: groups[key].make,
      model: groups[key].model,
      trim: groups[key].trim,
      label: groups[key].label,
      widestGap: widest,
      home: { id: home.id, name: home.name, count: homeUnits.length, avgDiscount: homeUnits.length ? GCY_avg_(homeUnits) : null, avgPercent: homeUnits.length ? GCY_avgPercent_(homeUnits) : null, units: homeUnits },
      competitors: competitors
    });
  }
  rows.sort(function (a, b) {
    return String(a.model).localeCompare(String(b.model)) || String(a.trim).localeCompare(String(b.trim)) || String(a.year).localeCompare(String(b.year));
  });
  return rows;
}

function GCY_avg_(units) {
  var sum = 0;
  for (var i = 0; i < units.length; i++) sum += units[i].dealerDiscount;
  return Math.round(sum / units.length);
}

function GCY_avgPercent_(units) {
  var sum = 0;
  var count = 0;
  for (var i = 0; i < units.length; i++) {
    if (units[i].discountPercent == null) continue;
    sum += units[i].discountPercent;
    count++;
  }
  return count ? Math.round((sum / count) * 10) / 10 : null;
}
