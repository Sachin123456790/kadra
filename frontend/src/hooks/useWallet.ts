import { useState, useEffect, useCallback } from 'react';

interface WalletProvider {
  name: string;
  icon?: string;
  rdns?: string;
  provider: any;
}

type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWalletReturn {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  error: string | null;
  availableProviders: WalletProvider[];
  connectWallet: (provider?: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (tx: { to: string; data: string; value?: string }) => Promise<string>;
  disconnect: () => void;
}

export function useWallet(): UseWalletReturn {
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<WalletProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<any>(null);

  useEffect(() => {
    const win = window as any;

    // EIP-6963: listen for provider announcements
    const announced: WalletProvider[] = [];
    const handleAnnounce = (event: any) => {
      const { info, provider } = event.detail || {};
      if (info && provider) {
        announced.push({
          name: info.name,
          icon: info.icon,
          rdns: info.rdns,
          provider,
        });
        setAvailableProviders([...announced]);
      }
    };
    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Fallback: check window.ethereum
    setTimeout(() => {
      if (announced.length === 0 && win.ethereum) {
        const fallback: WalletProvider = {
          name: win.ethereum.isMetaMask ? 'MetaMask' : win.ethereum.isPhantom ? 'Phantom' : 'Browser Wallet',
          provider: win.ethereum,
        };
        setAvailableProviders([fallback]);
      }
    }, 300);

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    };
  }, []);

  const connectWallet = useCallback(async (provider?: any): Promise<{ address: string; chainId: number }> => {
    const p = provider || (window as any).ethereum;
    if (!p) {
      setError('No wallet provider found. Please install MetaMask or Phantom.');
      setStatus('error');
      throw new Error('No wallet provider found');
    }

    setStatus('connecting');
    setError(null);

    try {
      const accounts: string[] = await p.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      const chainHex: string = await p.request({ method: 'eth_chainId' });
      const chain = parseInt(chainHex, 16);

      setAddress(addr);
      setChainId(chain);
      setActiveProvider(p);
      setStatus('connected');
      return { address: addr, chainId: chain };
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect wallet';
      setError(msg);
      setStatus('error');
      throw new Error(msg);
    }
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const p = activeProvider || (window as any).ethereum;
    if (!p || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature: string = await p.request({
        method: 'personal_sign',
        params: [message, address],
      });
      return signature;
    } catch (err: any) {
      const msg = err?.code === 4001 ? 'Signature request was rejected' : (err?.message || 'Failed to sign message');
      setError(msg);
      throw new Error(msg);
    }
  }, [activeProvider, address]);

  const sendTransaction = useCallback(async (tx: { to: string; data: string; value?: string }): Promise<string> => {
    const p = activeProvider || (window as any).ethereum;
    if (!p || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      const txHash: string = await p.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: tx.to,
          data: tx.data,
          value: tx.value || '0x0',
        }],
      });
      return txHash;
    } catch (err: any) {
      const msg = err?.code === 4001 ? 'Transaction was rejected by user' : (err?.message || 'Failed to send transaction');
      setError(msg);
      throw new Error(msg);
    }
  }, [activeProvider, address]);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setAddress(null);
    setChainId(null);
    setError(null);
    setActiveProvider(null);
  }, []);

  return { status, address, chainId, error, availableProviders, connectWallet, signMessage, sendTransaction, disconnect };
}
