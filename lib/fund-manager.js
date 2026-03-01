const funds = new Map();

function createFund({ name, legalForm, jurisdiction, totalShares }) {
  const fund = {
    name,
    legalForm,
    jurisdiction,
    totalShares,
    waterfall: null,
    createdAt: new Date().toISOString(),
  };
  funds.set(name, fund);
  return fund;
}

function configureFundWaterfall(fundName, { preferredReturn, returnOfCapital, irrHurdle, gpPromote }) {
  const fund = funds.get(fundName);
  if (!fund) return null;
  fund.waterfall = { preferredReturn, returnOfCapital, irrHurdle, gpPromote };
  return fund;
}

function getFund(name) {
  return funds.get(name) || null;
}

function getAllFunds() {
  return Array.from(funds.values());
}

function resetFunds() {
  funds.clear();
}

module.exports = { createFund, configureFundWaterfall, getFund, getAllFunds, resetFunds };
