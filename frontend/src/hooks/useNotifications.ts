import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { ADMIN_ROLES, DEFAULT_FUND_CODE, QUERY_KEYS } from '@/config/constants';
import { getSubscriptions } from '@/services/subscriptions.service';
import { getOwnershipHistory } from '@/services/ownership.service';
import { getInvestors } from '@/services/investors.service';
import { getMySubscriptions, getMyTransfers } from '@/services/investor-portal.service';

export interface AppNotification {
  id: string;
  message: string;
  timestamp: Date;
  type: 'settlement' | 'subscription' | 'transfer' | 'mint' | 'general';
  read: boolean;
}

const STORAGE_KEY = 'kadra_read_notifications';

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useNotifications() {
  const { user } = useAuth();
  const isAdmin = user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);
  const fundId = DEFAULT_FUND_CODE;

  // Admin: fetch subscriptions + ownership events + investors for name lookup
  const { data: subscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
    enabled: !!isAdmin,
  });

  const { data: ownershipEvents } = useQuery({
    queryKey: QUERY_KEYS.ownershipHistory(fundId),
    queryFn: () => getOwnershipHistory(fundId).then(r => r.data),
    enabled: !!isAdmin,
  });

  const { data: investors } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then(r => r.data),
    enabled: !!isAdmin,
  });

  // Investor: fetch my subscriptions + my transfers
  const { data: mySubscriptions } = useQuery({
    queryKey: [...QUERY_KEYS.investorSubscriptions(fundId), 'notif'],
    queryFn: () => getMySubscriptions(fundId).then(r => r.data),
    enabled: !isAdmin && !!user,
  });

  const { data: myTransfers } = useQuery({
    queryKey: [...QUERY_KEYS.investorTransfers(fundId), 'notif'],
    queryFn: () => getMyTransfers(fundId).then(r => r.data),
    enabled: !isAdmin && !!user,
  });

  const notifications = useMemo((): AppNotification[] => {
    const readIds = getReadIds();
    const items: AppNotification[] = [];

    // Build investor name lookup
    const investorNameMap = new Map<string, string>();
    if (investors) {
      for (const inv of investors) {
        investorNameMap.set(inv.investorId, inv.legalName);
      }
    }

    if (isAdmin) {
      // Derive from subscriptions
      if (subscriptions) {
        for (const sub of subscriptions) {
          const investorName = investorNameMap.get(sub.investorId) || sub.subscriptionRef;
          if (sub.status === 'SETTLED' && sub.settledAt) {
            items.push({
              id: `settlement-${sub.subscriptionId}`,
              message: `Settlement confirmed for ${investorName}`,
              timestamp: new Date(sub.settledAt),
              type: 'settlement',
              read: readIds.has(`settlement-${sub.subscriptionId}`),
            });
          } else if (sub.status === 'PENDING') {
            items.push({
              id: `subscription-${sub.subscriptionId}`,
              message: `New subscription created: ${sub.subscriptionRef}`,
              timestamp: new Date(), // no createdAt in admin subscription response
              type: 'subscription',
              read: readIds.has(`subscription-${sub.subscriptionId}`),
            });
          }
        }
      }

      // Derive from ownership events
      if (ownershipEvents) {
        for (const evt of ownershipEvents) {
          const ts = new Date(evt.eventTimestamp);
          if (evt.eventType === 'TRANSFER') {
            const fromShort = `${evt.fromWalletAddress.slice(0, 6)}...${evt.fromWalletAddress.slice(-4)}`;
            const toShort = `${evt.toWalletAddress.slice(0, 6)}...${evt.toWalletAddress.slice(-4)}`;
            items.push({
              id: `transfer-${evt.eventId}`,
              message: `Transfer ${fromShort} to ${toShort} completed`,
              timestamp: ts,
              type: 'transfer',
              read: readIds.has(`transfer-${evt.eventId}`),
            });
          } else if (evt.eventType === 'MINT') {
            const toShort = `${evt.toWalletAddress.slice(0, 6)}...${evt.toWalletAddress.slice(-4)}`;
            items.push({
              id: `mint-${evt.eventId}`,
              message: `Tokens minted to wallet ${toShort}`,
              timestamp: ts,
              type: 'mint',
              read: readIds.has(`mint-${evt.eventId}`),
            });
          }
        }
      }
    } else {
      // Investor notifications
      if (mySubscriptions) {
        for (const sub of mySubscriptions) {
          if (sub.status === 'SETTLED' && sub.settledAt) {
            items.push({
              id: `my-settlement-${sub.id}`,
              message: `Your subscription ${sub.subscriptionRef} has been settled`,
              timestamp: new Date(sub.settledAt),
              type: 'settlement',
              read: readIds.has(`my-settlement-${sub.id}`),
            });
          }
          items.push({
            id: `my-sub-${sub.id}`,
            message: `Subscription ${sub.subscriptionRef} created`,
            timestamp: new Date(sub.createdAt),
            type: 'subscription',
            read: readIds.has(`my-sub-${sub.id}`),
          });
        }
      }

      if (myTransfers) {
        for (const tx of myTransfers) {
          const fromShort = `${tx.fromWalletAddress.slice(0, 6)}...${tx.fromWalletAddress.slice(-4)}`;
          const toShort = `${tx.toWalletAddress.slice(0, 6)}...${tx.toWalletAddress.slice(-4)}`;
          items.push({
            id: `my-transfer-${tx.id}`,
            message: `Transfer ${fromShort} to ${toShort} ${tx.requestStatus.toLowerCase()}`,
            timestamp: new Date(tx.createdAt),
            type: 'transfer',
            read: readIds.has(`my-transfer-${tx.id}`),
          });
        }
      }
    }

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items;
  }, [isAdmin, subscriptions, ownershipEvents, investors, mySubscriptions, myTransfers]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);
  }, []);

  const markAllAsRead = useCallback(() => {
    const readIds = getReadIds();
    for (const n of notifications) {
      readIds.add(n.id);
    }
    saveReadIds(readIds);
  }, [notifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

/** Format a timestamp as relative time (e.g., "2m ago", "1h ago", "3d ago") */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
