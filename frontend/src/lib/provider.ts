import { ethers } from "ethers";

const HARDHAT_RPC = "http://127.0.0.1:8545";

let provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
  }
  return provider;
}

export async function getSigner(index: number): Promise<ethers.JsonRpcSigner> {
  const p = getProvider();
  return p.getSigner(index);
}

export async function getSignerAddress(index: number): Promise<string> {
  const signer = await getSigner(index);
  return signer.getAddress();
}
