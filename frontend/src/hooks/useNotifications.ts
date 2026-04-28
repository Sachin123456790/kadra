import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { ADMIN_ROLES, DEFAULT_FUND_CODE, QUERY_KEYS } from '@/config/constants';
import { getSubscriptions } from '@/services/subscriptions.service';
import { getOwnershipHistory } from '@/services/ownership.service';
import { getInvestors } from '@/services/investors.service';
import { getMySubscriptions, getMyTransfers } from '@/services/investor-portal.service';
import { getInvestorNotices } from '@/services/notices.service';
import { useAppConfig } from './useAppConfig';

export interface AppNotification {
  id: string;
  message: string;
  timestamp: Date;
  type: 'settlement' | 'subscription' | 'transfer' | 'transfer_notice' | 'mint' | 'general';
  read: boolean;
  /** Deterministic in-app route to navigate to on click. */
  targetRoute: string;
  /** Optional ID of the related entity (subscription, transfer, etc.) for highlight/scroll. */
  targetId?: string;
}

/**
 * Build an in-app route for a notification given the current role.
 * Falls back to the role's home if no specific destination applies.
 */
export function getNotificationRoute(
  kind: AppNotification['type'],
  role: 'admin' | 'investor',
  targetId?: string,
): string {
  const highlight = targetId ? `?highlight=${encodeURIComponent(targetId)}` : '';
  if (role === 'admin') {
    switch (kind) {
      case 'settlement':
        return `/settlement${highlight}`;
      case 'subscription':
        return `/subscriptions${highlight}`;
      case 'transfer':
      case 'transfer_notice':
        return `/transfers${highlight}`;
      case 'mint':
        return `/cap-table${highlight}`;
      default:
        return '/dashboard';
    }
  }
  switch (kind) {
    case 'settlement':
      return `/investor/capital-account${highlight}`;
    case 'subscription':
      return `/investor${highlight}`;
    case 'transfer':
    case 'transfer_notice':
      return `/investor/transfers${highlight}`;
    case 'mint':
      return `/investor/capital-account${highlight}`;
    default:
      return '/investor';
  }
}

const STORAGE_KEY = 'angainor_read_notifications';

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
  const { data: appConfig } = useAppConfig();
  const isAdmin = user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);
  const fundId = appConfig?.defaults.fundCode ?? DEFAULT_FUND_CODE;

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

  const { data: myNotices } = useQuery({
    queryKey: [...QUERY_KEYS.investorNotices(), 'notif'],
    queryFn: () => getInvestorNotices().then(r => r.data),
    enabled: !isAdmin && !!user,
  });

  const notifications = useMemo((): AppNotification[] => {
    const readIds = getReadIds();
    const items: AppNotification[] = [];
    const role: 'admin' | 'investor' = isAdmin ? 'admin' : 'investor';

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
              targetId: sub.subscriptionId,
              targetRoute: getNotificationRoute('settlement', role, sub.subscriptionId),
            });
          } else if (sub.status === 'PENDING') {
            // Only surface a timestamp if the backend actually returned one.
            // Fabricating `new Date()` on render made every refresh look like
            // a brand-new notification.
            if (sub.createdAt) {
              items.push({
                id: `subscription-${sub.subscriptionId}`,
                message: `New subscription created: ${sub.subscriptionRef}`,
                timestamp: new Date(sub.createdAt),
                type: 'subscription',
                read: readIds.has(`subscription-${sub.subscriptionId}`),
                targetId: sub.subscriptionId,
                targetRoute: getNotificationRoute('subscription', role, sub.subscriptionId),
              });
            }
          }
        }
      }

      // Derive from ownership events
      if (ownershipEvents) {
        // Build wallet-to-investor name lookup for enriched messages
        const walletToName = new Map<string, string>();
        if (investors) {
          for (const inv of investors) {
            if (inv.wallets) {
              for (const w of inv.wallets) {
                if (w.walletAddress) {
                  walletToName.set(w.walletAddress.toLowerCase(), inv.legalName);
                }
              }
            }
          }
        }

        for (const evt of ownershipEvents) {
          const ts = new Date(evt.eventTimestamp);
          if (evt.eventType === 'TRANSFER') {
            const fromAddr = evt.fromWalletAddress ?? '';
            const toAddr = evt.toWalletAddress ?? '';
            const fromName = fromAddr ? walletToName.get(fromAddr.toLowerCase()) : undefined;
            const toName = toAddr ? walletToName.get(toAddr.toLowerCase()) : undefined;
            const fromLabel = fromName ?? (fromAddr ? `${fromAddr.slice(0, 6)}...${fromAddr.slice(-4)}` : 'Unknown');
            const toLabel = toName ?? (toAddr ? `${toAddr.slice(0, 6)}...${toAddr.slice(-4)}` : 'Unknown');
            const amountPart = evt.tokenAmount != null ? ` (${evt.tokenAmount} KDRA)` : '';
            const status = evt.status === 'BLOCKED' || evt.status === 'FAILED' ? 'blocked' : 'completed';
            const transferType = status === 'blocked' ? 'transfer_notice' : 'transfer';
            // TODO(notifications): OwnershipEvent exposes `eventId` but TransfersPage
            // rows use `transferRequestId` as `data-highlight-id`. The backend
            // DTO needs to surface `transferRequestId` before the highlight can
            // resolve on admin transfer notifications. Until then, clicking the
            // notification navigates to /transfers but the row scroll silently
            // no-ops (useHighlightRow find-and-scroll terminates after 20
            // attempts with no side effects).
            items.push({
              id: `transfer-${evt.eventId}`,
              message: `Transfer from ${fromLabel} to ${toLabel}${amountPart} ${status}`,
              timestamp: ts,
              type: transferType,
              read: readIds.has(`transfer-${evt.eventId}`),
              targetId: evt.eventId,
              targetRoute: getNotificationRoute(transferType, role, evt.eventId),
            });
          } else if (evt.eventType === 'MINT') {
            const mintAddr = evt.toWalletAddress ?? '';
            const toName = mintAddr ? walletToName.get(mintAddr.toLowerCase()) : undefined;
            const toLabel = toName ?? (mintAddr ? `${mintAddr.slice(0, 6)}...${mintAddr.slice(-4)}` : 'Unknown');
            const amountPart = evt.tokenAmount != null ? ` (${evt.tokenAmount} KDRA)` : '';
            items.push({
              id: `mint-${evt.eventId}`,
              message: `Tokens minted to ${toLabel}${amountPart}`,
              timestamp: ts,
              type: 'mint',
              read: readIds.has(`mint-${evt.eventId}`),
              targetId: evt.eventId,
              targetRoute: getNotificationRoute('mint', role, evt.eventId),
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
              targetId: sub.id,
              targetRoute: getNotificationRoute('settlement', role, sub.id),
            });
          }
          if (sub.mintTxHash && sub.mintedAt) {
            items.push({
              id: `my-mint-${sub.id}`,
              message: `Tokens minted for subscription ${sub.subscriptionRef}`,
              timestamp: new Date(sub.mintedAt),
              type: 'mint',
              read: readIds.has(`my-mint-${sub.id}`),
              targetId: sub.id,
              targetRoute: getNotificationRoute('mint', role, sub.id),
            });
          }
          items.push({
            id: `my-sub-${sub.id}`,
            message: `Subscription ${sub.subscriptionRef} created`,
            timestamp: new Date(sub.createdAt),
            type: 'subscription',
            read: readIds.has(`my-sub-${sub.id}`),
            targetId: sub.id,
            targetRoute: getNotificationRoute('subscription', role, sub.id),
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
            targetId: tx.id,
            targetRoute: getNotificationRoute('transfer', role, tx.id),
          });
        }
      }

      if (myNotices) {
        for (const notice of myNotices) {
          const kind =
            notice.type === 'TRANSFER'
              ? 'transfer_notice'
              : notice.type === 'TOKEN_MINTED'
                ? 'mint'
                : 'general';
          items.push({
            id: `my-notice-${notice.id}`,
            message: `${notice.type.replace(/_/g, ' ')} notice available`,
            timestamp: new Date(notice.generatedAt),
            type: kind,
            read: readIds.has(`my-notice-${notice.id}`),
            targetId: notice.id,
            targetRoute: '/investor/documents?tab=notices',
          });
        }
      }
    }

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items;
  }, [isAdmin, subscriptions, ownershipEvents, investors, mySubscriptions, myTransfers, myNotices]);

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
