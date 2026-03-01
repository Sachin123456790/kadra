function validateSettlement({ subscriptionId, wireAmount, wireInvestorId, wireDocumentRef, subscriptionLedger }) {
  const errors = [];
  const subscription = subscriptionLedger.getSubscription(subscriptionId);

  if (!subscription) {
    return { valid: false, errors: ["Subscription not found"], subscription: null };
  }
  if (subscription.status !== "pending") {
    errors.push(`Subscription already ${subscription.status} — no double settlement`);
  }
  if (subscription.investorId !== wireInvestorId) {
    errors.push(`Investor mismatch: expected ${subscription.investorId}, got ${wireInvestorId}`);
  }
  if (subscription.capitalCommitted !== wireAmount) {
    errors.push(`Amount mismatch: expected ${subscription.capitalCommitted}, got ${wireAmount}`);
  }
  if (subscription.lpaHash !== wireDocumentRef) {
    errors.push(`Document reference mismatch: expected ${subscription.lpaHash}, got ${wireDocumentRef}`);
  }

  return { valid: errors.length === 0, errors, subscription };
}

module.exports = { validateSettlement };
