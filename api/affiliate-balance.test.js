const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateAvailableAffiliateBalance } = require('./affiliate-balance');

test('uses the stored affiliate balance when it is available', () => {
  assert.equal(calculateAvailableAffiliateBalance({ affiliateBalance: 10000, totalEarned: 0, totalRequested: 0 }), 10000);
});

test('falls back to the ledger balance when the affiliate balance is missing', () => {
  assert.equal(calculateAvailableAffiliateBalance({ affiliateBalance: 0, totalEarned: 15000, totalRequested: 5000 }), 10000);
});

test('never reports a negative balance', () => {
  assert.equal(calculateAvailableAffiliateBalance({ affiliateBalance: 0, totalEarned: 5000, totalRequested: 10000 }), 0);
});
