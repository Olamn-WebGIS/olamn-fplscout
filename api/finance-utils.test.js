const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAdminTransactionPayload, summarizeTransactions } = require('./finance-utils');

test('normalizes admin transaction payloads and defaults the status', () => {
  const payload = normalizeAdminTransactionPayload({
    type: 'manual',
    amount: '1500',
    note: 'Test entry',
    payment_reference: ''
  });

  assert.deepEqual(payload, {
    type: 'manual',
    amount: 1500,
    status: 'completed',
    payment_reference: null,
    note: 'Test entry',
    user_id: null,
    created_at: payload.created_at
  });
});

test('rejects invalid amounts and computes revenue, payouts, and profit', () => {
  assert.throws(() => normalizeAdminTransactionPayload({ type: 'subscription', amount: '-10' }), /amount/i);

  const summary = summarizeTransactions([
    { type: 'subscription', amount: 1000 },
    { type: 'other_income', amount: 250 },
    { type: 'affiliate_payout', amount: 200 },
    { type: 'other_expense', amount: 400 },
    { type: 'manual', amount: 50 }
  ]);

  assert.equal(summary.revenue, 1250);
  assert.equal(summary.payouts, 650);
  assert.equal(summary.profit, 600);
});
