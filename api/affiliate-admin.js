function normalizeAffiliateBalancePayload(payload = {}) {
  const rawAmount = payload?.amount;
  const parsedAmount = Number(rawAmount);

  if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
    throw new Error('Affiliate balance must be a valid non-negative number.');
  }

  return {
    amount: parsedAmount
  };
}

module.exports = {
  normalizeAffiliateBalancePayload
};
