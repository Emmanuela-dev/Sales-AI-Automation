'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivities, createActivity } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  MessageSquare, Phone, Mail, Calendar, GitBranch,
  Bell, Plus, Loader2,
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ElementType> = {
  note:         MessageSquare,
  call:         Phone,
  email:        Mail,
  meeting:      Calendar,
  stage_change: GitBranch,
  follow_up:    Bell,
};

const TYPE_COLORS: Record<string, string> = {
  note:         'bg-slate-100 text-slate-600',
  call:         'bg-green-100 text-green-600',
  email:        'bg-blue-100 text-blue-600',
  meeting:      'bg-orange-100 text-orange-600',
  stage_change: 'bg-purple-100 text-purple-600',
  follow_up:    'bg-yellow-100 text-yellow-600',
};

export function ActivityFeed({ leadId }: { leadId: string }) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['activities', leadId],
    queryFn: () => getActivities(leadId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createActivity({ lead_id: leadId, type: 'note', title: note }),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['activities', leadId] });
      toast({ title: 'Note added' });
    },
    onError: () => toast({ title: 'Failed to add note', variant: 'destructive' }),
  });

  const activities = data?.activities ?? [];

  return (
    <div className="space-y-4">
      {/* Quick note input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a note, call log, or update..."
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && note.trim()) addMutation.mutate();
          }}
          aria-label="Add activity note"
        />
        <Button
          size="icon"
          onClick={() => addMutation.mutate()}
          disabled={!note.trim() || addMutation.isPending}
          aria-label="Save note"
        >
          {addMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Plus className="h-4 w-4" />
          }
        </Button>
      </div>

      {/* Feed */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      )}

      {!isLoading && activities.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No activity yet. Add a note above to start tracking.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {activities.map((a: {
          id: string; type: string; title: string;
          description?: string; created_at: string;
        }) => {
          const Icon = TYPE_ICONS[a.type] ?? MessageSquare;
          return (
            <div key={a.id} className="flex gap-3 group">
              <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${TYPE_COLORS[a.type] ?? 'bg-slate-100 text-slate-600'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{a.type.replace('_', ' ')}</Badge>
                </div>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(a.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
