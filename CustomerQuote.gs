/**
 * Customer interactive quote — web app + share links.
 *
 * Quote options (packages, accessories, rates, FICO labels, store info)
 * live in QUOTE_CATALOG / QUOTE_RATES / CREDIT_TIERS / CONFIG — not in HTML.
 *
 * A snapshot of those sheets is stored with each token so a live customer
 * link does not change when someone later edits the catalog.
 */

function isUsableWebAppUrl_(url) {
  var s = normalizeWebAppUrl_(url);
  if (!s) return false;
  if (!/^https:\/\/script\.google\.com\//i.test(s)) return false;
  if (/YOUR_DEPLOYMENT_ID|REPLACE_WITH_YOUR_DEPLOYMENT_ID/i.test(s)) return false;
  return /\/exec$/i.test(s);
}

function normalizeWebAppUrl_(url) {
  var s = String(url || '').trim();
  if (!s) return '';
  s = s.split('#')[0].split('?')[0].replace(/\/+$/, '');
  if (!/^https:\/\/script\.google\.com\//i.test(s)) return s;
  if (/YOUR_DEPLOYMENT_ID|REPLACE_WITH_YOUR_DEPLOYMENT_ID/i.test(s)) return s;
  // Workspace /a/macros/domain/... URLs fail for customers outside the domain.
  s = s.replace(/^https:\/\/script\.google\.com\/a\/macros\/[^/]+\/s\//i, 'https://script.google.com/macros/s/');
  s = s.replace(/^https:\/\/script\.google\.com\/a\/[^/]+\/macros\/s\//i, 'https://script.google.com/macros/s/');
  if (/\/exec$/i.test(s)) return s;
  if (/\/dev$/i.test(s)) return s.replace(/\/dev$/i, '/exec');
  if (/\/s\/[^/]+$/i.test(s)) return s + '/exec';
  return s;
}

function detectDeployedWebAppUrl_() {
  try {
    if (typeof ScriptApp !== 'undefined' && ScriptApp.getService) {
      var live = ScriptApp.getService().getUrl();
      if (isUsableWebAppUrl_(live)) return normalizeWebAppUrl_(live);
    }
  } catch (e) {}
  return '';
}

function rememberWebAppUrl_(url, force) {
  if (!isUsableWebAppUrl_(url)) return;
  var s = normalizeWebAppUrl_(url);
  try {
    var current = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
    if (!force && isUsableWebAppUrl_(current) && normalizeWebAppUrl_(current) === s) return;
    PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', s);
  } catch (e) {}
  try {
    upsertConfigValue_('webAppUrl', s, 'Published Web App URL for customer quote links. GEAUX Desk → Save Web App URL fills this.');
  } catch (e2) {}
}

function getWebAppUrl_() {
  var candidates = [];
  try {
    var stored = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
    if (stored) candidates.push(stored);
  } catch (e) {}
  try {
    var map = getConfigMap();
    if (map && map.webAppUrl) candidates.push(map.webAppUrl);
  } catch (e2) {}
  var detected = detectDeployedWebAppUrl_();
  if (detected) candidates.push(detected);

  for (var i = 0; i < candidates.length; i++) {
    if (!isUsableWebAppUrl_(candidates[i])) continue;
    var url = normalizeWebAppUrl_(candidates[i]);
    rememberWebAppUrl_(url);
    return url;
  }
  return '';
}

function buildQuoteShareLink_(token, baseUrl) {
  var base = baseUrl == null ? getWebAppUrl_() : baseUrl;
  if (!isUsableWebAppUrl_(base) || !token) return '';
  return normalizeWebAppUrl_(base) + '?token=' + encodeURIComponent(token);
}

function setWebAppUrl() {
  var url = detectDeployedWebAppUrl_();
  if (!isUsableWebAppUrl_(url)) {
    try {
      var map = getConfigMap();
      if (map && map.webAppUrl) url = map.webAppUrl;
    } catch (e) {}
  }
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e2) { ui = null; }
  if (!isUsableWebAppUrl_(url)) {
    var msg =
      'No published Web App URL yet.\n\n' +
      '1. Extensions → Apps Script\n' +
      '2. Deploy → New deployment → Web app\n' +
      '3. Execute as: Me  (not “User accessing the web app”)\n' +
      '4. Who has access: Anyone  (not “Anyone with a Google account”)\n' +
      '5. Deploy, then GEAUX Desk → Save Web App URL\n\n' +
      'Until that works, use EMAIL QUOTE. The attached HTML file opens without Google Drive.';
    if (ui) ui.alert(msg);
    else console.log(msg);
    return;
  }
  rememberWebAppUrl_(url, true);
  var saved =
    'Web App URL saved:\n\n' + normalizeWebAppUrl_(url) + '\n\n' +
    'Test that URL in an incognito window while signed out. You should see a GEAUX “quote service is live” page — not Google Drive.\n\n' +
    'Then open CUSTOMER QUOTE and use EMAIL QUOTE, or copy the gold-bar /exec?token= link.';
  if (ui) ui.alert(saved);
  else console.log(saved);
}

function parseIdList_(v) {
  if (!v) return [];
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return v.map(function (x) { return String(x); }).filter(Boolean);
  }
  return String(v).split(/[,;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function snapshotQuoteConfig_(deskData) {
  var runtime = getQuoteRuntimeConfig(deskData);
  var d = normalizeDeskData(deskData);
  var settings = runtime.settings;
  var defaultTerm = toNumber_(d.quoteDefaultTerm) || settings.defaultTerm || 72;
  var allow = d.quoteAllowTermChange;
  var allowTermChange = settings.allowTermChange;
  if (allow !== undefined && allow !== '') {
    var allowStr = String(allow).toLowerCase();
    allowTermChange = !(allowStr === 'no' || allowStr === 'false' || allowStr === '0');
  }

  var preProt = parseIdList_(d.quotePreselectedProtection);
  var preAcc = parseIdList_(d.quotePreselectedAccessories);
  if (!preProt.length) {
    preProt = runtime.protection.filter(function (i) { return i.defaultOn; }).map(function (i) { return i.id; });
  }
  if (!preAcc.length) {
    preAcc = runtime.accessories.filter(function (i) { return i.defaultOn; }).map(function (i) { return i.id; });
  }

  return {
    settings: {
      storeName: settings.storeName,
      storeCity: settings.storeCity,
      storePhone: settings.storePhone,
      defaultTerm: defaultTerm,
      allowTermChange: allowTermChange,
      defaultCreditTier: d.quoteDefaultTier || settings.defaultCreditTier || 'a1',
      useOddDaysOnQuote: settings.useOddDaysOnQuote
    },
    protection: runtime.protection.map(withAbsoluteBrochure_),
    accessories: runtime.accessories.map(withAbsoluteBrochure_),
    rates: runtime.rates,
    tiers: runtime.tiers,
    preselectedProtection: preProt,
    preselectedAccessories: preAcc
  };
}

function ensureQuoteStore_() {
  var ss = getActiveSs_();
  var store = ss.getSheetByName('QUOTE_STORE');
  if (!store) {
    store = ss.insertSheet('QUOTE_STORE');
    store.hideSheet();
    store.getRange(1, 1, 1, 8).setValues([[
      'Token', 'DealNumber', 'Created', 'Expires', 'PublicJSON', 'CustomerEmail', 'CustomerPhone', 'Status'
    ]]);
    store.setFrozenRows(1);
  }
  return store;
}

function newQuoteToken_() {
  return 'QT_' + Utilities.getUuid().replace(/-/g, '');
}

function storeQuoteDeal_(deskData, dealNumber) {
  var store = ensureQuoteStore_();
  var settings = getStoreSettings();
  var ttlDays = settings.quoteTtlDays || 14;
  var now = new Date();
  var expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  var token = newQuoteToken_();
  var publicDesk = redactDeskForCustomer(deskData);
  publicDesk.dealNumber = dealNumber;
  var snapshot = snapshotQuoteConfig_(deskData);
  var payload = {
    desk: publicDesk,
    config: snapshot
  };
  store.appendRow([
    token,
    dealNumber,
    now.toLocaleString('en-US', { timeZone: 'America/Chicago' }),
    expires.toISOString(),
    JSON.stringify(payload),
    deskData.email || '',
    deskData.cellPhone || '',
    'active'
  ]);
  return token;
}

function getStoredQuoteRecord_(token) {
  if (!token) return null;
  var store = getActiveSs_().getSheetByName('QUOTE_STORE');
  if (!store) return null;
  var data = store.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(token)) continue;
    var status = String(data[i][7] || 'active').toLowerCase();
    var expiresRaw = data[i][3];
    var expires = expiresRaw ? new Date(expiresRaw) : null;
    if (expires && !isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      return { expired: true };
    }
    if (status && status !== 'active') return { expired: true };
    try {
      var parsed = JSON.parse(data[i][4]);
      return {
        token: token,
        dealNumber: data[i][1],
        payload: parsed,
        email: data[i][5],
        phone: data[i][6],
        row: i + 1
      };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function buildQuoteHtml_(record, extras) {
  extras = extras || {};
  var desk = (record.payload && record.payload.desk) ? record.payload.desk : {};
  var config = (record.payload && record.payload.config) ? record.payload.config : snapshotQuoteConfig_(desk);
  var pageData = Object.assign({}, desk, extras, {
    _token: record.token,
    _isManagerPreview: !!extras._isManagerPreview
  });
  if (extras._shareLink) pageData._shareLink = extras._shareLink;
  if (extras._webAppUrl) pageData._webAppUrl = extras._webAppUrl;

  var rawHtml = HtmlService.createHtmlOutputFromFile('customerQuote').getContent();
  var html = injectJson_(rawHtml, '__DESK_DATA_PLACEHOLDER__', pageData);
  html = injectJson_(html, '__QUOTE_CONFIG_PLACEHOLDER__', config);
  return html;
}

function buildSavedCustomerQuote_(deskData, extras) {
  extras = extras || {};
  ensureConfigSheets();
  var d = normalizeDeskData(deskData);
  var stagingRow = resolveStagingRow_(d.manager);
  var deskSheet = getDeskSheet_();
  var existingDealNum = String(d.dealNumber || '').trim();
  var quoteDealNum = existingDealNum || String(getNextDealNumber_(deskSheet));
  d.dealNumber = quoteDealNum;

  var rowData = buildRowData_(d, quoteDealNum);
  writeDeskRow_(deskSheet, stagingRow, rowData);
  if (!existingDealNum) {
    var lastRow = Math.max(4, deskSheet.getLastRow());
    writeDeskRow_(deskSheet, lastRow + 1, rowData);
  } else {
    var existingRow = findDealRow_(deskSheet, quoteDealNum);
    if (existingRow > 0) writeDeskRow_(deskSheet, existingRow, rowData);
  }

  var token = storeQuoteDeal_(d, quoteDealNum);
  var shareLink = buildQuoteShareLink_(token);
  var htmlStr = buildQuoteHtml_({
    token: token,
    payload: { desk: redactDeskForCustomer(d), config: snapshotQuoteConfig_(d) }
  }, {
    _shareLink: shareLink,
    _webAppUrl: getWebAppUrl_(),
    _isManagerPreview: extras.managerPreview === true
  });
  return {
    htmlStr: htmlStr,
    dealNumber: quoteDealNum,
    shareLink: shareLink,
    token: token,
    desk: d
  };
}

function getCustomerQuoteHtmlWithSave(deskData) {
  return withSheetLock_(function () {
    return buildSavedCustomerQuote_(deskData, { managerPreview: true });
  });
}

function emailCustomerQuote(deskData) {
  var built = withSheetLock_(function () {
    return buildSavedCustomerQuote_(deskData, { managerPreview: false });
  });
  var to = String((built.desk && built.desk.email) || '').trim();
  if (!to || to.indexOf('@') === -1) {
    throw new Error('Enter the customer Email on the desk first, then click EMAIL QUOTE.');
  }
  var store = {};
  try { store = getStoreSettings(); } catch (e) {}
  var storeName = store.storeName || 'GEAUX Chevrolet';
  var subject = storeName + ' quote — Deal #' + built.dealNumber;
  var body =
    'Your personalized ' + storeName + ' quote is attached.\n\n' +
    'Open the HTML file on your phone or computer. You do not need a Google login.\n';
  if (built.shareLink) {
    body += '\nOr open this link:\n' + built.shareLink + '\n';
  }
  var blob = Utilities.newBlob(built.htmlStr, 'text/html', 'GEAUX-Quote-' + built.dealNumber + '.html');
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    attachments: [blob]
  });
  return {
    success: true,
    emailedTo: to,
    dealNumber: built.dealNumber,
    shareLink: built.shareLink || ''
  };
}

function testCustomerWebApp() {
  var url = getWebAppUrl_();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { ui = null; }
  if (!isUsableWebAppUrl_(url)) {
    setWebAppUrl();
    return;
  }
  var msg =
    'Open this URL in an incognito window while signed OUT of Google:\n\n' + url + '\n\n' +
    'PASS: a GEAUX page that says the quote service is live.\n' +
    'FAIL: Google Drive “unable to open the file”.\n\n' +
    'If it fails: Apps Script → Deploy → Manage deployments → pencil on the Web app → Execute as Me, Who has access Anyone (not “Anyone with a Google account”) → New version → Deploy.\n\n' +
    'You can still send quotes with EMAIL QUOTE (HTML attachment).';
  if (ui) ui.alert(msg);
  else console.log(msg);
}

function generateShareableLink(deskData) {
  ensureConfigSheets();
  var d = normalizeDeskData(deskData);
  var stagingRow = resolveStagingRow_(d.manager);
  return withSheetLock_(function () {
    var deskSheet = getDeskSheet_();
    var existingDealNum = String(d.dealNumber || '').trim();
    var quoteDealNum = existingDealNum || String(getNextDealNumber_(deskSheet));
    d.dealNumber = quoteDealNum;
    if (!existingDealNum) {
      var rowData = buildRowData_(d, quoteDealNum);
      writeDeskRow_(deskSheet, stagingRow, rowData);
      var lastRow = Math.max(4, deskSheet.getLastRow());
      writeDeskRow_(deskSheet, lastRow + 1, rowData);
    }
    var token = storeQuoteDeal_(d, quoteDealNum);
    return {
      shareLink: buildQuoteShareLink_(token),
      dealNumber: quoteDealNum
    };
  });
}

function quoteErrorPage_(title, message) {
  var store = {};
  try { store = getStoreSettings(); } catch (e) {}
  var name = store.storeName || 'GEAUX Chevrolet';
  var city = store.storeCity || '';
  var phone = store.storePhone || '';
  return HtmlService.createHtmlOutput(
    '<html><body style="font-family:Arial;text-align:center;padding:60px;color:#0d1f33;">' +
    '<h2>' + escapeHtml(title) + '</h2>' +
    '<p>' + escapeHtml(message) + '</p>' +
    '<p><strong>' + escapeHtml(name) +
    (city ? ' &bull; ' + escapeHtml(city) : '') +
    (phone ? ' &bull; ' + escapeHtml(phone) : '') +
    '</strong></p></body></html>'
  ).setTitle(name + ' — Quote');
}

function withAbsoluteBrochure_(item) {
  var out = {};
  for (var k in item) {
    if (Object.prototype.hasOwnProperty.call(item, k)) out[k] = item[k];
  }
  var url = String(item.brochureUrl || '').trim();
  if (url && /^https?:\/\//i.test(url)) {
    out.brochureUrl = url;
    return out;
  }
  var base = getWebAppUrl_();
  if (isUsableWebAppUrl_(base)) {
    out.brochureUrl = String(base).replace(/\/$/, '') + '?brochure=' + encodeURIComponent(item.id);
  }
  return out;
}

function serveBrochure_(id) {
  id = String(id || '').trim();
  var catalog = getQuoteCatalog();
  var item = null;
  for (var i = 0; i < catalog.length; i++) {
    if (catalog[i].id === id) { item = catalog[i]; break; }
  }
  var url = item && item.brochureUrl ? String(item.brochureUrl).trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) {
    try {
      var folder = getOrCreateBrochureFolder_();
      var filename = BROCHURE_FILES_[id];
      var file = filename ? findBrochureFile_(folder, filename) : null;
      if (file) url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    } catch (e) {}
  }
  if (url && /^https?:\/\//i.test(url)) {
    var safe = escapeHtml(url);
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=' + safe + '">' +
      '<title>Opening brochure</title></head><body style="font-family:Arial,sans-serif;padding:24px;">' +
      'Opening brochure… <a href="' + safe + '">Open PDF</a></body></html>'
    ).setTitle('Brochure');
  }
  var name = item ? escapeHtml(item.name) : escapeHtml(id);
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Brochure</title></head>' +
    '<body style="font-family:Arial,sans-serif;padding:32px;max-width:560px;">' +
    '<h2>' + name + '</h2><p>The PDF brochure is not linked yet. Copy the files from the <code>brochures/</code> folder into Drive, then run <strong>GEAUX Desk → Publish quote brochures</strong>, or paste a link in the QUOTE_CATALOG <em>BrochureUrl</em> column.</p>' +
    '</body></html>'
  ).setTitle('Brochure');
}

function doGet(e) {
  ensureConfigSheets();
  var live = detectDeployedWebAppUrl_();
  if (live) rememberWebAppUrl_(live);
  var brochureId = e && e.parameter && e.parameter.brochure ? e.parameter.brochure : null;
  if (brochureId) return serveBrochure_(brochureId);
  var token = e && e.parameter && e.parameter.token ? e.parameter.token : null;
  if (!token) {
    return quoteErrorPage_(
      'Quote service is live',
      'This Web App is working. Ask your salesperson for your personal quote link (it includes ?token=).'
    );
  }
  var record = getStoredQuoteRecord_(token);
  if (!record || record.expired) {
    return quoteErrorPage_('Quote Not Found', 'This quote link may have expired or is no longer valid. Please contact your salesperson for a fresh quote link.');
  }
  var html = buildQuoteHtml_(record, { _webAppUrl: getWebAppUrl_() });
  var store = getStoreSettings();
  return HtmlService.createHtmlOutput(html)
    .setTitle((store.storeName || 'GEAUX Chevrolet') + ' — Your Personalized Quote')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function buildAuthoritativeSubmission_(record, payload) {
  payload = payload || {};
  var desk = (record.payload && record.payload.desk) || {};
  var config = (record.payload && record.payload.config) || snapshotQuoteConfig_(desk);
  var protIds = parseIdList_(payload.protectionPackages || payload.protectionIds);
  var accIds = parseIdList_(payload.accessories || payload.accessoryIds);
  // Allow either ids or names; prefer ids. If names, map through catalog.
  protIds = resolveCatalogIds_(protIds, config.protection);
  accIds = resolveCatalogIds_(accIds, config.accessories);

  var term = parseInt(payload.term, 10) || config.settings.defaultTerm || toNumber_(desk.term) || 72;
  if (!config.settings.allowTermChange) {
    term = config.settings.defaultTerm || term;
  }
  var tierKey = String(payload.creditTier || config.settings.defaultCreditTier || 'a1');
  var apr = getRateFromMatrix(config.rates, term, tierKey);
  if (apr === null) {
    var valid = getValidTermsForTier(config.rates, tierKey);
    if (valid.length) {
      term = valid[valid.length - 1];
      apr = getRateFromMatrix(config.rates, term, tierKey);
    }
  }
  if (apr === null) apr = toNumber_(desk.rate);

  var down = toNumber_(payload.downPayment != null ? payload.downPayment : desk.cashDeposit);
  if (down < 0) down = 0;

  var calc = calculateDeal(desk, {
    protectionIds: protIds,
    accessoryIds: accIds,
    protectionCatalog: config.protection,
    accessoryCatalog: config.accessories,
    downPayment: down,
    apr: apr,
    term: term,
    useOddDays: config.settings.useOddDaysOnQuote !== false
  });

  var tier = null;
  for (var i = 0; i < (config.tiers || []).length; i++) {
    if (config.tiers[i].key === tierKey) { tier = config.tiers[i]; break; }
  }
  var creditTierLabel = tier
    ? (tier.label + (tier.ficoRange ? ' | ' + tier.ficoRange : ''))
    : String(payload.creditTierLabel || tierKey);

  return {
    token: record.token,
    dealNumber: desk.dealNumber || record.dealNumber,
    customerName: desk.customerName || '',
    salesperson: desk.salesperson || '',
    vehicle: [desk.year, desk.make, desk.model].filter(Boolean).join(' '),
    creditTier: tierKey,
    creditTierLabel: creditTierLabel,
    apr: calc.rate,
    term: calc.term,
    downPayment: calc.downPayment,
    protectionPackages: calc.protectionItems.map(function (x) { return x.name; }),
    accessories: calc.accessoryItems.map(function (x) { return x.name; }),
    accessoriesDetail: calc.accessoryItems,
    protectionTotal: calc.protectionTotal,
    accessoriesTotal: calc.accessoriesTotal,
    amountFinanced: calc.totalFinanced,
    monthlyPayment: calc.payment,
    feesDetail: calc.feeDetail,
    customerNotes: String(payload.customerNotes || '').slice(0, 2000),
    calc: calc
  };
}

function resolveCatalogIds_(values, catalog) {
  var out = [];
  var list = catalog || [];
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i]);
    var found = null;
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].id) === v || String(list[j].name) === v) {
        found = list[j].id;
        break;
      }
    }
    if (found) out.push(found);
  }
  return out;
}

function receiveCustomerSubmission(payloadJson) {
  try {
    var payload = (typeof payloadJson === 'string') ? JSON.parse(payloadJson) : payloadJson;
    var record = getStoredQuoteRecord_(payload.token || '');
    if (!record || record.expired) {
      return { success: false, error: 'Quote not found or expired' };
    }
    var result = buildAuthoritativeSubmission_(record, payload);
    logCustomerResponse_(record, result);
    try {
      sendSalespersonEmail_(record, result);
    } catch (emailErr) {
      console.error('Direct email failed (will retry from queue): ' + emailErr.message);
      queueEmail_(record, result);
    }
    return {
      success: true,
      submission: {
        monthlyPayment: result.monthlyPayment,
        amountFinanced: result.amountFinanced,
        apr: result.apr,
        term: result.term,
        downPayment: result.downPayment,
        creditTierLabel: result.creditTierLabel,
        protectionPackages: result.protectionPackages,
        accessories: result.accessories
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result = receiveCustomerSubmission(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ensureEmailQueue_() {
  var ss = getActiveSs_();
  var emailQueue = ss.getSheetByName('EMAIL_QUEUE');
  if (!emailQueue) {
    emailQueue = ss.insertSheet('EMAIL_QUEUE');
    emailQueue.hideSheet();
    emailQueue.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Status', 'RecordJSON', 'ResultJSON']]);
  }
  return emailQueue;
}

function queueEmail_(record, result) {
  var emailQueue = ensureEmailQueue_();
  emailQueue.appendRow([
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
    'pending',
    JSON.stringify({ email: record.email, phone: record.phone, payload: record.payload, token: record.token }),
    JSON.stringify(result)
  ]);
}

function processEmailQueue() {
  var ss = getActiveSs_();
  var emailQueue = ss.getSheetByName('EMAIL_QUEUE');
  if (!emailQueue || emailQueue.getLastRow() < 2) return;
  var rows = emailQueue.getDataRange().getValues();
  var toDelete = [];
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() !== 'pending') continue;
    try {
      var record = JSON.parse(rows[i][2]);
      var result = JSON.parse(rows[i][3]);
      sendSalespersonEmail_(record, result);
      toDelete.push(i + 1);
    } catch (e) {
      console.error('Queue email failed row ' + (i + 1) + ': ' + e.message);
    }
  }
  for (var j = toDelete.length - 1; j >= 0; j--) {
    emailQueue.deleteRow(toDelete[j]);
  }
}

function ensureResponsesSheet_() {
  var ss = getActiveSs_();
  var sheet = ss.getSheetByName('CUSTOMER_RESPONSES');
  if (!sheet) {
    sheet = ss.insertSheet('CUSTOMER_RESPONSES');
    sheet.getRange(1, 1, 1, 18).setValues([[
      'Timestamp', 'Deal #', 'Customer', 'Salesperson', 'Vehicle',
      'Credit Tier', 'APR (%)', 'Term (mo)', 'Down Payment ($)',
      'Protection Packages', 'Accessories',
      'Monthly Payment ($)', 'Amount Financed ($)',
      'Protection Total ($)', 'Accessories Total ($)',
      'Customer Email', 'Customer Phone', 'Notes'
    ]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 18).setFontWeight('bold').setBackground('#0d1f33').setFontColor('white');
  }
  return sheet;
}

function logCustomerResponse_(record, result) {
  var sheet = ensureResponsesSheet_();
  var ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  sheet.appendRow([
    ts,
    result.dealNumber || '',
    result.customerName || '',
    result.salesperson || '',
    result.vehicle || '',
    result.creditTierLabel || '',
    result.apr || '',
    result.term || '',
    result.downPayment || 0,
    (result.protectionPackages || []).join(', '),
    (result.accessories || []).join(', '),
    result.monthlyPayment || '',
    result.amountFinanced || '',
    result.protectionTotal || 0,
    result.accessoriesTotal || 0,
    record.email || '',
    record.phone || '',
    result.customerNotes || ''
  ]);
}

function sendSalespersonEmail_(record, result) {
  var settings = getStoreSettings();
  var allRecipients = settings.notifyEmails;
  if (!allRecipients) {
    console.error('notifyEmails is empty in CONFIG — skipping email');
    return;
  }
  var customerName = result.customerName || 'Customer';
  var dealNum = result.dealNumber || '—';
  var veh = result.vehicle || '—';
  var salesperson = result.salesperson || '—';
  var protList = (result.protectionPackages || []).length ? result.protectionPackages.join(', ') : 'None selected';
  var accList = (result.accessories || []).length ? result.accessories.join(', ') : 'None selected';
  var store = settings.storeName || 'GEAUX Chevrolet';
  var city = settings.storeCity || '';

  var subject = 'Customer Quote Submission — ' + customerName + ' | Deal #' + dealNum;

  var body =
    store + ' — Customer Quote Submission\n' +
    'Customer:     ' + customerName + '\n' +
    'Deal #:       ' + dealNum + '\n' +
    'Vehicle:      ' + veh + '\n' +
    'Salesperson:  ' + salesperson + '\n' +
    'Submitted:    ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }) + '\n\n' +
    'Credit Tier:       ' + (result.creditTierLabel || '—') + '\n' +
    'Interest Rate:     ' + (result.apr || '—') + '%\n' +
    'Loan Term:         ' + (result.term || '—') + ' months\n' +
    'Down Payment:      $' + Number(result.downPayment || 0).toFixed(2) + '\n\n' +
    'Protection: ' + protList + ' ($' + Number(result.protectionTotal || 0).toFixed(2) + ')\n' +
    'Accessories: ' + accList + ' ($' + Number(result.accessoriesTotal || 0).toFixed(2) + ')\n\n' +
    'Amount Financed:   $' + Number(result.amountFinanced || 0).toFixed(2) + '\n' +
    'Monthly Payment:   $' + Number(result.monthlyPayment || 0).toFixed(2) + '\n\n' +
    (result.customerNotes ? ('CUSTOMER NOTES:\n' + result.customerNotes + '\n\n') : '') +
    'Logged to CUSTOMER_RESPONSES.\n';

  var accRows = (result.accessoriesDetail && result.accessoriesDetail.length)
    ? result.accessoriesDetail.map(function (acc) {
      return '<tr><td style="padding:6px 10px;">' + escapeHtml(acc.name) +
        '</td><td style="padding:6px 10px;text-align:right;">$' +
        Number(acc.price).toFixed(2) + '</td></tr>';
    }).join('')
    : '<tr><td style="padding:6px 10px;" colspan="2">None selected</td></tr>';

  var feeRows = (result.feesDetail && result.feesDetail.length)
    ? result.feesDetail.map(function (fee) {
      return '<tr><td style="padding:6px 10px;">' + escapeHtml(fee.label) +
        '</td><td style="padding:6px 10px;text-align:right;">$' +
        Number(fee.amount).toFixed(2) + '</td></tr>';
    }).join('')
    : '<tr><td style="padding:6px 10px;" colspan="2">No additional fees</td></tr>';

  var notesHtml = result.customerNotes
    ? '<div style="margin-top:16px;padding:12px;background:#fff3cd;border-radius:6px;"><strong>Customer Notes:</strong><br>' +
      formatEmailSafe_(result.customerNotes) + '</div>'
    : '';

  var htmlBody =
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
    '<div style="background:#0d1f33;padding:20px 24px;border-radius:8px 8px 0 0;">' +
    '<h2 style="color:#c8a84b;margin:0;font-style:italic;">' + escapeHtml(store) + '</h2>' +
    '<p style="color:#aac4e0;margin:4px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Customer Quote Submission</p></div>' +
    '<div style="background:#f8f9fa;padding:20px 24px;border:1px solid #ddd;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
    '<tr><td style="padding:6px 0;color:#666;width:140px;">Customer</td><td style="padding:6px 0;font-weight:bold;">' + escapeHtml(customerName) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#666;">Deal #</td><td style="padding:6px 0;font-weight:bold;">' + escapeHtml(dealNum) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#666;">Vehicle</td><td style="padding:6px 0;">' + escapeHtml(veh) + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#666;">Salesperson</td><td style="padding:6px 0;">' + escapeHtml(salesperson) + '</td></tr>' +
    '</table>' +
    '<hr style="border:none;border-top:2px solid #c8a84b;margin:16px 0;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
    '<tr style="background:#e8f0f8;"><td style="padding:8px 10px;font-weight:bold;" colspan="2">Financing</td></tr>' +
    '<tr><td style="padding:6px 10px;color:#666;">Credit Tier</td><td style="padding:6px 10px;">' + escapeHtml(result.creditTierLabel || '—') + '</td></tr>' +
    '<tr><td style="padding:6px 10px;color:#666;">Interest Rate</td><td style="padding:6px 10px;">' + escapeHtml(result.apr) + '%</td></tr>' +
    '<tr><td style="padding:6px 10px;color:#666;">Term</td><td style="padding:6px 10px;">' + escapeHtml(result.term) + ' months</td></tr>' +
    '<tr><td style="padding:6px 10px;color:#666;">Down Payment</td><td style="padding:6px 10px;font-weight:bold;">$' + Number(result.downPayment || 0).toFixed(2) + '</td></tr>' +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">' +
    '<tr style="background:#e8f0f8;"><td style="padding:8px 10px;font-weight:bold;" colspan="2">Protection Packages</td></tr>' +
    '<tr><td style="padding:6px 10px;" colspan="2">' + escapeHtml(protList) + '</td></tr>' +
    '<tr><td style="padding:6px 10px;color:#666;">Protection Subtotal</td><td style="padding:6px 10px;font-weight:bold;">$' + Number(result.protectionTotal || 0).toFixed(2) + '</td></tr>' +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">' +
    '<tr style="background:#e8f0f8;"><td style="padding:8px 10px;font-weight:bold;" colspan="2">Accessories</td></tr>' +
    accRows +
    '<tr><td style="padding:6px 10px;color:#666;">Accessories Subtotal</td><td style="padding:6px 10px;font-weight:bold;">$' + Number(result.accessoriesTotal || 0).toFixed(2) + '</td></tr>' +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">' +
    '<tr style="background:#e8f0f8;"><td style="padding:8px 10px;font-weight:bold;" colspan="2">Fees Breakdown</td></tr>' +
    feeRows +
    '</table>' +
    '<div style="background:#0d1f33;border-radius:8px;padding:16px 20px;margin-top:16px;text-align:center;">' +
    '<div style="color:#aac4e0;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Estimated Monthly Payment</div>' +
    '<div style="color:#c8a84b;font-size:36px;font-weight:900;margin:4px 0;">$' + Number(result.monthlyPayment || 0).toFixed(2) + '</div>' +
    '<div style="color:white;font-size:13px;">' + escapeHtml(result.term) + ' months @ ' + escapeHtml(result.apr) + '% APR' +
    ' | Amount Financed: $' + Number(result.amountFinanced || 0).toFixed(2) + '</div></div>' +
    notesHtml +
    '</div>' +
    '<div style="background:#0d1f33;padding:12px 24px;border-radius:0 0 8px 8px;text-align:center;">' +
    '<p style="color:#aac4e0;font-size:11px;margin:0;">' + escapeHtml(store) + (city ? ' &bull; ' + escapeHtml(city) : '') + '</p></div></div>';

  MailApp.sendEmail({
    to: allRecipients,
    subject: subject,
    body: body,
    htmlBody: htmlBody
  });
}

function getCustomerQuoteHtml(deskData) {
  var d = normalizeDeskData(deskData);
  return buildQuoteHtml_({
    token: '',
    payload: { desk: redactDeskForCustomer(d), config: snapshotQuoteConfig_(d) }
  }, { _isManagerPreview: true });
}

function testEmailNotification() {
  var settings = getStoreSettings();
  var recipients = settings.notifyEmails;
  if (!recipients) throw new Error('Set notifyEmails in the CONFIG sheet first.');
  MailApp.sendEmail({
    to: recipients,
    subject: 'TEST — Customer Quote Email Notification',
    body: 'This is a test email from the Customer Quote Tool.\n\nIf you received this, notifications are working.\n\n' +
      settings.storeName + ' | ' + settings.storeCity
  });
  console.log('Test email sent to: ' + recipients);
}
