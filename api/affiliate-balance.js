function calculateAvailableAffiliateBalance({ affiliateBalance = 0, totalEarned = 0, totalRequested = 0 }) {
  const balanceFromAffiliateRecord = Number(affiliateBalance || 0);
  const balanceFromLedger = Math.max(0, Number(totalEarned || 0) - Number(totalRequested || 0));
  const effectiveBalance = balanceFromAffiliateRecord > 0 ? balanceFromAffiliateRecord : balanceFromLedger;
  return Math.max(0, effectiveBalance);
}

module.exports = { calculateAvailableAffiliateBalance };
