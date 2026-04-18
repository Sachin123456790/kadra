import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/kadra/PageHeader';
import { SectionCard } from '@/components/kadra/SectionCard';
import { EmptyState } from '@/components/kadra/EmptyState';
import { useNotifications, formatRelativeTime } from '@/hooks/useNotifications';
import type { AppNotification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import {
  Landmark, FileText, ArrowLeftRight, Coins, Bell,
} from 'lucide-react';

const typeIcons: Record<AppNotification['type'], typeof Bell> = {
  settlement: Landmark,
  subscription: FileText,
  transfer: ArrowLeftRight,
  transfer_notice: ArrowLeftRight,
  mint: Coins,
  general: Bell,
};

const typeColors: Record<AppNotification['type'], string> = {
  settlement: 'bg-green-100 text-green-700',
  subscription: 'bg-blue-100 text-blue-700',
  transfer: 'bg-purple-100 text-purple-700',
  transfer_notice: 'bg-purple-100 text-purple-700',
  mint: 'bg-amber-100 text-amber-700',
  general: 'bg-gray-100 text-gray-700',
};

type FilterType = 'all' | AppNotification['type'];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const handleOpen = (notificationId: string, targetRoute: string) => {
    markAsRead(notificationId);
    navigate(targetRoute);
  };

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Settlements', value: 'settlement' },
    { label: 'Subscriptions', value: 'subscription' },
    { label: 'Transfers', value: 'transfer' },
    { label: 'Minting', value: 'mint' },
  ];

  if (notifications.length === 0) {
    return (
      <div>
        <PageHeader title="Notifications" subtitle="Stay updated on fund activity" />
        <EmptyState
          title="No notifications yet"
          message="Notifications will appear here as fund activity occurs — settlements, subscriptions, transfers, and more."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on fund activity"
        action={
          unreadCount > 0 ? (
            <button
              onClick={markAllAsRead}
              className="text-sm text-primary hover:underline font-medium"
            >
              Mark all as read
            </button>
          ) : null
        }
      />

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md border transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SectionCard>
        <div className="divide-y divide-border -mx-6 -my-6">
          {filtered.map(notification => {
            const Icon = typeIcons[notification.type];
            return (
              <button
                key={notification.id}
                onClick={() => handleOpen(notification.id, notification.targetRoute)}
                className={cn(
                  'w-full flex items-start gap-4 px-6 py-4 text-left transition-colors cursor-pointer',
                  'hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset',
                  !notification.read && 'bg-primary/5',
                )}
              >
                <div className={cn('mt-0.5 p-2 rounded-lg shrink-0', typeColors[notification.type])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-sm leading-snug',
                      notification.read ? 'text-muted-foreground' : 'font-medium text-foreground',
                    )}>
                      {notification.message}
                    </p>
                    {!notification.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(notification.timestamp)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No {filter} notifications found.
        </div>
      )}
    </div>
  );
}
