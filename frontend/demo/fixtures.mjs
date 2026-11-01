// Hand-authored fictional data only. No customer export or production connection.
export const stamp = '2026-11-01T12:00:00Z';
export const fundId = 'ANGAINOR-DEMO-001';
export const demoUser = { id: 'demo-reviewer', email: 'preview@example.test', role: 'admin', fullName: 'Demo Reviewer' };
export const docs = [
  ['lpa', 'MASTER_LPA', 'Preview Fund I LPA.html'],
  ['amendment', 'LPA_AMENDMENT', 'First Amendment.html'],
  ['side', 'SIDE_LETTER', 'Preview Investor Side Letter.html'],
].map(([documentId, documentType, originalFilename]) => ({
  documentId, documentType, originalFilename, extractedFieldCount: 1,
  mimeType: 'text/html', byteSize: 1400, parseStatus: 'COMPLETED', version: 1,
  uploadedBy: 'demo-reviewer', linkedEntityType: 'FUND', linkedEntityId: fundId,
  hash: { hashHex: 'a'.repeat(64), algorithm: 'SHA-256', anchoredOnchain: false },
  metadata: { synthetic: true }, createdAt: stamp, updatedAt: stamp,
}));
export const fund = {
  fundId, fundName: 'Preview Real Estate Fund I', status: 'ACTIVE', legalForm: 'Limited Partnership',
  lpCount: 5, eligibleWalletCount: 0, pendingSubscriptions: 2, settledSubscriptions: 3,
  targetCommitment: '100000000', totalCommittedAmount: '80000000', totalSettledAmount: '55000000',
  tokenContract: null, createdAt: stamp,
};
export const config = {
  chainId: 11155111, explorerBaseUrl: 'https://sepolia.etherscan.io',
  contracts: { identityRegistry: null, documentRegistry: null, angainorToken: null, fundTermsRegistry: null },
  defaults: { fundCode: fundId, fundName: fund.fundName, tokenSymbol: 'DEMO', tokenDecimals: 18, targetSize: 100000000, totalSupply: 0 },
};
const names = ['Demo Cedar Partners', 'Demo Harbor Holdings', 'Demo Maple Trust', 'Demo Summit Capital', 'Demo Willow Ventures'];
const commitments = [25000000, 20000000, 10000000, 15000000, 10000000];
export const investors = names.map((legalName, index) => ({
  investorId: `demo-investor-${index + 1}`, legalName, email: `investor-${index + 1}@example.test`,
  createdAt: stamp, verificationStatus: 'UNKNOWN', kycStatus: 'PENDING', accreditationStatus: 'PENDING',
  wallets: [], fundEligibility: null,
}));
export const subscriptions = investors.map((investor, index) => ({
  subscriptionId: `demo-sub-${index + 1}`, subscriptionRef: `DEMO-${index + 1}`, investorId: investor.investorId,
  investorName: investor.legalName, walletId: '', allocationPct: commitments[index] / 1000000,
  committedAmount: String(commitments[index]), status: index < 3 ? 'SETTLED' : 'PENDING',
  settledAt: index < 3 ? stamp : null, createdAt: stamp, governingHashHex: null,
  latestSettlementStatus: index < 3 ? 'CONFIRMED' : null, settlementTxHash: null,
  mintTxHash: null, mintedAt: null, mintEventId: null,
}));
export const capitalCalls = [{
  id: 'demo-call-1', fundId, callNumber: 1, amountDue: '60000000', dueDate: '2026-11-15',
  wireInstructions: null, status: 'PARTIALLY_RECEIVED', createdAt: stamp, responses: [],
}];
export const allocation = {
  fundId, fundCapPct: 100, perInvestorCapPct: 100, totalAllocationPct: 80,
  totalCommitted: 80000000, targetCommitment: 100000000, remainingHeadroomPct: 20,
  investors: investors.map((investor, index) => ({
    investorId: investor.investorId, investorName: investor.legalName, investorEmail: investor.email,
    totalAllocationPct: commitments[index] / 1000000, totalCommitted: commitments[index],
    settledAllocationPct: index < 3 ? commitments[index] / 1000000 : 0,
    pendingAllocationPct: index >= 3 ? commitments[index] / 1000000 : 0, subscriptionCount: 1,
  })),
};
export const waterfall = {
  waterfallConfigId: 'demo-waterfall', version: '1', calculationBasis: 'Whole fund', distributionFrequency: 'Quarterly',
  catchUpEnabled: true, gpPromotePct: 20, prefReturnPct: 8,
  rules: { tiers: [
    { name: 'Return of capital', hurdle: 'Contributed capital', lpShare: 100, gpShare: 0 },
    { name: 'Preferred return', hurdle: '8% preferred return', lpShare: 100, gpShare: 0 },
    { name: 'Residual split', hurdle: 'After preferred return', lpShare: 80, gpShare: 20 },
  ] },
};
export const events = [
  { id: 'demo-event-1', eventType: 'DOCUMENT_UPLOADED', aggregateType: 'DOCUMENT', aggregateId: 'lpa', payload: { description: 'Preview Fund I LPA.html' }, metadata: { synthetic: true }, occurredAt: stamp, txHash: null, blockNumber: null },
  { id: 'demo-event-2', eventType: 'CAPITAL_CALL_ISSUED', aggregateType: 'CAPITAL_CALL', aggregateId: 'demo-call-1', payload: { amount: 60000000 }, metadata: { synthetic: true }, occurredAt: stamp, txHash: null, blockNumber: null },
];
export const sourceTerms = {
  lpa: ['management_fee', '1.5% per annum during the investment period'],
  amendment: ['target_commitment', '$100,000,000'],
  side: ['reporting_frequency', 'Quarterly investor reporting'],
};
export function sourceHtml(documentId) {
  const doc = docs.find((item) => item.documentId === documentId);
  const [field, value] = sourceTerms[documentId];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${doc.originalFilename}</title>
  <style>body{font:16px/1.8 system-ui;max-width:700px;margin:48px auto;padding:24px;color:#222;background:#fff}small{color:#85532e}h1{line-height:1.3}aside{padding:16px;background:#f8f1e9;border:1px solid #ead8c6}</style>
  <small>ANGAINOR CONTROL ROOM · SYNTHETIC DEMO</small><h1>${doc.originalFilename.replace('.html', '')}</h1>
  <aside>Fictional source material for interface review. This is not a signed agreement or an operative fund document.</aside>
  <h2>Illustrative governing term</h2><p><strong>${field.replaceAll('_', ' ')}:</strong> ${value}.</p>
  <p>The extracted field in the workspace reflects this sample provision. The source, review, and provenance views demonstrate the interface only.</p>
  <p>All names, amounts, terms, identifiers, and records in this demo are synthetic.</p></html>`;
}
