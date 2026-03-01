let subscriptions = [];
let nextId = 1;

function createSubscription({ investorId, investorName, walletAddress, allocationPercent, lpaHash, fundName, capitalCommitted }) {
  const id = "sub-" + String(nextId).padStart(3, "0");
  nextId++;
  const record = {
    id,
    investorId,
    investorName,
    walletAddress,
    allocationPercent,
    lpaHash,
    fundName,
    capitalCommitted,
    status: "pending",
    createdAt: new Date().toISOString(),
    settledAt: null,
  };
  subscriptions.push(record);
  return record;
}

function getSubscription(id) {
  return subscriptions.find((s) => s.id === id) || null;
}

function getAllSubscriptions() {
  return subscriptions;
}

function getByFund(fundName) {
  return subscriptions.filter((s) => s.fundName === fundName);
}

function getByInvestor(investorId) {
  return subscriptions.filter((s) => s.investorId === investorId);
}

function updateStatus(id, newStatus) {
  const sub = getSubscription(id);
  if (!sub) return null;
  sub.status = newStatus;
  if (newStatus === "settled") {
    sub.settledAt = new Date().toISOString();
  }
  return sub;
}

function resetLedger() {
  subscriptions = [];
  nextId = 1;
}

module.exports = {
  createSubscription,
  getSubscription,
  getAllSubscriptions,
  getByFund,
  getByInvestor,
  updateStatus,
  resetLedger,
};
