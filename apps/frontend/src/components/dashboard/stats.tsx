'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  Building2, TrendingUp, Mail, Calendar, Trophy, DollarSign,
} from 'lucide-react';

const STAT_CONFIG = [
  {
    key: 'businesses_found',
    label: 'Businesses Found',
    icon: Building2,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950',
  },
  {
    key: 'high_value_prospects',
    label: 'High-Value Prospects',
    icon: TrendingUp,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950',
  },
  {
    key: 'emails_sent',
    label: 'Emails Sent',
    icon: Mail,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950',
  },
  {
    key: 'meetings_booked',
    label: 'Meetings Booked',
    icon: Calendar,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950',
  },
  {
    key: 'clients_won',
    label: 'Clients Won',
    icon: Trophy,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950',
  },
  {
    key: 'revenue_total',
    label: 'Revenue (KES)',
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    isCurrency: true,
  },
];

export function DashboardStats({ period = 'month' }: { period?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => getDashboardStats(period),
    staleTime: 30_000,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg, isCurrency }) => (
        <Card key={key} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="text-2xl font-bold leading-none">
                {isCurrency
                  ? formatCurrency(data?.[key] ?? 0, data?.currency ?? 'KES')
                  : formatNumber(data?.[key] ?? 0)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
