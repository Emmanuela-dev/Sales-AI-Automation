'use client';

import { useQuery } from '@tanstack/react-query';
import { getLeads } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getStatusColor, getScoreColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';

export function RecentLeads() {
  const { data, isLoading } = useQuery({
    queryKey: ['leads', { limit: '8' }],
    queryFn: () => getLeads({ limit: '8' }),
    staleTime: 30_000,
  });

  const leads = data?.leads ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Leads</CardTitle>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
          <Link href="/leads">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="px-6 pb-6 space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && leads.length === 0 && (
          <div className="px-6 pb-6 text-center py-8 text-sm text-muted-foreground">
            <Building2 className="h-6 w-6 mx-auto mb-2 opacity-20" />
            <p>No leads yet.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="divide-y">
            {leads.map((lead: {
              id: string;
              status: string;
              opportunity_score?: number;
              updated_at: string;
              businesses: { name: string; industry: string; city: string };
            }) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center gap-4 px-6 py-3 hover:bg-accent/40 transition-colors group"
                aria-label={`View lead: ${lead.businesses?.name}`}
              >
                {/* Business info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {lead.businesses?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lead.businesses?.industry} · {lead.businesses?.city}
                  </p>
                </div>

                {/* Score */}
                {lead.opportunity_score != null && (
                  <div className="hidden sm:flex items-center gap-2 w-24 shrink-0">
                    <span className={`text-xs font-bold ${getScoreColor(lead.opportunity_score)}`}>
                      {lead.opportunity_score}
                    </span>
                    <Progress
                      value={lead.opportunity_score}
                      className="h-1.5 flex-1"
                      aria-label={`Score: ${lead.opportunity_score}`}
                    />
                  </div>
                )}

                {/* Status */}
                <Badge
                  className={`${getStatusColor(lead.status)} text-xs capitalize hidden sm:flex`}
                  variant="outline"
                >
                  {lead.status}
                </Badge>

                {/* Time */}
                <span className="text-xs text-muted-foreground hidden lg:block whitespace-nowrap">
                  {timeAgo(lead.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
