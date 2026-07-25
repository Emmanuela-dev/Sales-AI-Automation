'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFollowUps, updateFollowUp } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, CheckCheck, X, Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export function FollowUpAlerts() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: getFollowUps,
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'sent' | 'dismissed' }) =>
      updateFollowUp(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
    },
  });

  const followUps = data?.follow_ups ?? [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-500" aria-hidden="true" />
          Follow-ups Due
          {followUps.length > 0 && (
            <Badge variant="warning" className="ml-auto text-xs">
              {followUps.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && followUps.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-20" />
            <p>All caught up!</p>
            <p className="text-xs mt-1">No follow-ups due right now.</p>
          </div>
        )}

        {followUps.slice(0, 5).map((fu: {
          id: string;
          leads: { businesses: { name: string } };
          trigger_type: string;
          message_suggestion: string;
          due_at: string;
        }) => (
          <div key={fu.id} className="rounded-lg border p-3 space-y-2 hover:bg-accent/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none truncate">
                  {fu.leads?.businesses?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {fu.trigger_type.replace(/_/g, ' ')} · {timeAgo(fu.due_at)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {fu.message_suggestion}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1 gap-1"
                onClick={() => mutation.mutate({ id: fu.id, status: 'sent' })}
                disabled={mutation.isPending}
                aria-label="Mark follow-up as sent"
              >
                {mutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCheck className="h-3 w-3" />
                }
                Mark sent
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => mutation.mutate({ id: fu.id, status: 'dismissed' })}
                disabled={mutation.isPending}
                aria-label="Dismiss follow-up"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
