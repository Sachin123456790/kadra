let accounts = [];

function createAccount({ investorId, fundName, initialContribution, ownershipPercent }) {
  const account = {
    investorId,
    fundName,
    initialContribution,
    ownershipPercent,
    dateContributed: new Date().toISOString(),
    capitalReturned: 0,
    accruedPreferredReturn: 0,
    residualAllocation: 0,
    endingCapitalBalance: initialContribution,
  };
  accounts.push(account);
  return account;
}

function getAccount(investorId, fundName) {
  return accounts.find((a) => a.investorId === investorId && a.fundName === fundName) || null;
}

function getByFund(fundName) {
  return accounts.filter((a) => a.fundName === fundName);
}

function updateForTransfer({ fromInvestorId, toInvestorId, fundName, transferPercent }) {
  const fromAccount = getAccount(fromInvestorId, fundName);
  const toAccount = getAccount(toInvestorId, fundName);
  if (!fromAccount || !toAccount) return null;

  const ratio = transferPercent / fromAccount.ownershipPercent;

  fromAccount.ownershipPercent -= transferPercent;
  toAccount.ownershipPercent += transferPercent;

  const capitalTransferred = fromAccount.capitalReturned * ratio;
  fromAccount.capitalReturned -= capitalTransferred;
  toAccount.capitalReturned += capitalTransferred;

  const balanceTransferred = fromAccount.endingCapitalBalance * ratio;
  fromAccount.endingCapitalBalance -= balanceTransferred;
  toAccount.endingCapitalBalance += balanceTransferred;

  return { from: fromAccount, to: toAccount };
}

function resetAccounts() {
  accounts = [];
}

module.exports = { createAccount, getAccount, getByFund, updateForTransfer, resetAccounts };
