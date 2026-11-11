/**
 * Mirrors normalizeDeal_ validation rules from Code.gs for offline checks.
 */

var STAGES = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
];

function defaultProbability(stage) {
  var map = {
    Prospecting: 10,
    Qualification: 25,
    Proposal: 50,
    Negotiation: 75,
    'Closed Won': 100,
    'Closed Lost': 0
  };
  return map[stage] != null ? map[stage] : 0;
}

function normalizeDeal(deal) {
  if (!deal || typeof deal !== 'object') {
    throw new Error('No deal data received.');
  }

  var dealName = String(deal.dealName || '').trim();
  var company = String(deal.company || '').trim();
  var stage = String(deal.stage || '').trim();
  var owner = String(deal.owner || '').trim();
  var notes = String(deal.notes || '').trim();
  var expectedClose = String(deal.expectedClose || '').trim();

  if (!dealName) throw new Error('Deal name is required.');
  if (!company) throw new Error('Company is required.');
  if (!stage || STAGES.indexOf(stage) === -1) throw new Error('Pick a valid stage.');

  var amount = Number(String(deal.amount || '').replace(/[$,\s]/g, ''));
  if (!isFinite(amount) || amount < 0) {
    throw new Error('Enter a valid amount (0 or greater).');
  }

  var probability =
    deal.probability === '' || deal.probability == null
      ? defaultProbability(stage)
      : Number(deal.probability);
  if (!isFinite(probability) || probability < 0 || probability > 100) {
    throw new Error('Probability must be between 0 and 100.');
  }

  if (!owner) owner = 'Unknown';

  return {
    dealName: dealName,
    company: company,
    amount: amount,
    stage: stage,
    probability: Math.round(probability),
    expectedClose: expectedClose,
    owner: owner,
    notes: notes
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertThrows(fn, messagePart) {
  var threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (String(err.message || err).indexOf(messagePart) === -1) {
      throw new Error('Expected error containing "' + messagePart + '", got: ' + err.message);
    }
  }
  if (!threw) throw new Error('Expected throw for: ' + messagePart);
}

var ok = normalizeDeal({
  dealName: '  Acme renewal ',
  company: 'Acme',
  amount: '$25,000',
  stage: 'Proposal',
  probability: '',
  owner: '',
  notes: 'Follow up Friday'
});

assertEqual(ok.dealName, 'Acme renewal', 'dealName trim');
assertEqual(ok.amount, 25000, 'amount parse');
assertEqual(ok.probability, 50, 'default probability');
assertEqual(ok.owner, 'Unknown', 'default owner');

assertThrows(function () {
  normalizeDeal({ company: 'Acme', amount: 1, stage: 'Proposal' });
}, 'Deal name is required');

assertThrows(function () {
  normalizeDeal({ dealName: 'X', company: 'Y', amount: -3, stage: 'Proposal' });
}, 'valid amount');

assertThrows(function () {
  normalizeDeal({
    dealName: 'X',
    company: 'Y',
    amount: 10,
    stage: 'Proposal',
    probability: 140
  });
}, 'Probability must be between');

console.log('deal-validation.test.js: all checks passed');
