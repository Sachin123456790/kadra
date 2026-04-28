// Minimal ABI for ERC-20 transfer — used by the investor wallet to sign transfers
export const ANGAINOR_TOKEN_TRANSFER_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * ABI-encode a transfer(address,uint256) call.
 * Returns hex string suitable for eth_sendTransaction data field.
 */
export function encodeTransfer(toAddress: string, amount: bigint): string {
  // Function selector: keccak256("transfer(address,uint256)") = 0xa9059cbb
  const selector = '0xa9059cbb';
  const paddedTo = toAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return `${selector}${paddedTo}${paddedAmount}`;
}
