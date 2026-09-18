/**
 * HTML helpers — pure JS (safe to load in Node tests).
 */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stringifyForScript_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Replaces a placeholder token with a JSON literal.
 * Accepts token with single quotes, double quotes, or bare.
 */
function injectJson_(html, placeholder, obj) {
  var json = stringifyForScript_(obj);
  var patterns = ["'" + placeholder + "'", '"' + placeholder + '"', placeholder];
  for (var i = 0; i < patterns.length; i++) {
    if (html.indexOf(patterns[i]) !== -1) {
      return html.replace(patterns[i], json);
    }
  }
  return html;
}

function formatEmailSafe_(s) {
  return escapeHtml(s).replace(/\n/g, '<br>');
}
