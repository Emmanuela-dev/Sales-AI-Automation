'use client';

import { useQuery } from '@tanstack/react-query';
import { getLeads } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getStatusColor, getScoreColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { Globe, AlertCircle, Star, Building2 } from 'lucide-react';
import { useLeadFilters } from '@/hooks/use-lead-filters';
import { cn } from '@/lib/utils';

interface LeadRow {
  id: string;
  status: string;
  opportunity_score?: number;
  updated_at: string;
  businesses: {
    name: string;
    industry: string;
    city: string;
    website?: string;
    google_rating?: number;
  };
}

export function LeadsTable() {
  const { filters } = useLeadFilters();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => getLeads(filters as Record<string, string>),
  });

  const leads: LeadRow[] = data?.leads ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-xl">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">No leads yet.</p>
        <p className="text-xs mt-1">Use <strong>Find Businesses</strong> to discover and save prospects.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm" role="grid" aria-label="Leads table">
        <thead>
          <tr className="border-b bg-muted/30">
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Business
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">
              Industry
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Status
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">
              Score
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden xl:table-cell">
              Web
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">
              Rating
            </th>
            <th scope="col" className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr
              key={lead.id}
              className="border-b last:border-0 hover:bg-accent/40 transition-colors"
            >
              {/* Business name */}
              <td className="px-4 py-3">
                <Link
                  href={`/leads/${lead.id}`}
                  className="group"
                  aria-label={`View lead: ${lead.businesses?.name}`}
                >
                  <p className="font-medium group-hover:text-primary transition-colors">
                    {lead.businesses?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{lead.businesses?.city}</p>
                </Link>
              </td>

              {/* Industry */}
              <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                {lead.businesses?.industry}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <Badge
                  className={cn(getStatusColor(lead.status), 'text-xs capitalize')}
                  variant="outline"
                >
                  {lead.status}
                </Badge>
              </td>

              {/* Score */}
              <td className="px-4 py-3 hidden lg:table-cell">
                {lead.opportunity_score != null ? (
                  <div className="flex items-center gap-2 w-28">
                    <span className={cn('text-xs font-bold w-6 text-right', getScoreColor(lead.opportunity_score))}>
                      {lead.opportunity_score}
                    </span>
                    <Progress value={lead.opportunity_score} className="h-1.5 flex-1" aria-label={`Score: ${lead.opportunity_score}`} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </td>

              {/* Website */}
              <td className="px-4 py-3 hidden xl:table-cell">
                {lead.businesses?.website ? (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    <span>Yes</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-orange-500">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    <span>None</span>
                  </div>
                )}
              </td>

              {/* Rating */}
              <td className="px-4 py-3 hidden sm:table-cell">
                {lead.businesses?.google_rating ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                    {lead.businesses.google_rating}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>

              {/* Updated */}
              <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(lead.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
