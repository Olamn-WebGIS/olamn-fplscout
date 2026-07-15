function normalizeAdminTransactionPayload(payload = {}, options = {}) {
  const { type, amount, user_id, status, payment_reference, note, created_at } = payload || {};
  const parsedAmount = Number(amount);

  if (!type || typeof type !== 'string' || !type.trim()) {
    throw new Error('Transaction type is required.');
  }

  if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
    throw new Error('Transaction amount must be a valid non-negative number.');
  }

  return {
    type: type.trim(),
    amount: parsedAmount,
    user_id: user_id || null,
    status: status || 'completed',
    payment_reference: payment_reference || null,
    note: note || null,
    created_at: created_at || new Date().toISOString()
  };
}

function isRevenueTransactionType(type) {
  const normalizedType = String(type || '').trim().toLowerCase();
  return normalizedType === 'subscription' || normalizedType === 'other_income';
}

function summarizeTransactions(transactions = []) {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const revenue = safeTransactions
    .filter((tx) => isRevenueTransactionType(tx?.type))
    .reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
  const payouts = safeTransactions
    .filter((tx) => !isRevenueTransactionType(tx?.type))
    .reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);
  return {
    revenue,
    payouts,
    profit: revenue - payouts
  };
}

module.exports = {
  normalizeAdminTransactionPayload,
  summarizeTransactions
};
