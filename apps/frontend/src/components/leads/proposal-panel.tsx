'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProposals, generateProposal, updateProposal } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Zap, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { useState as useLocalState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  negotiating: 'bg-yellow-100 text-yellow-700',
};

const SERVICE_PRESETS: Record<string, string[]> = {
  Hospitality:    ['Website Redesign', 'Online Booking System', 'SEO & Google Listing', 'Social Media Management'],
  Legal:          ['Professional Website', 'Client Portal', 'SEO', 'Case Management System'],
  Restaurant:     ['Website & Menu', 'Online Ordering', 'Social Media', 'Google Ads'],
  Healthcare:     ['Patient Website', 'Appointment Booking', 'HIPAA-compliant Portal', 'SEO'],
  Education:      ['School Website', 'Student Portal', 'Online Enrollment', 'LMS Integration'],
  Technology:     ['Corporate Website', 'Product Landing Page', 'SEO', 'Analytics Dashboard'],
  Default:        ['Website Redesign', 'SEO', 'Digital Marketing', 'Analytics Setup'],
};

export function ProposalPanel({ leadId, industry }: { leadId: string; industry?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const services = SERVICE_PRESETS[industry ?? ''] ?? SERVICE_PRESETS.Default;

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', leadId],
    queryFn: () => getProposals(leadId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateProposal({ lead_id: leadId, services }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', leadId] });
      toast({ title: 'Proposal generated', description: 'AI proposal is ready to review.' });
    },
    onError: () => toast({ title: 'Generation failed', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateProposal(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals', leadId] }),
  });

  const proposals = data?.proposals ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Auto-generates for: <strong>{services.slice(0, 2).join(', ')}</strong>
          {services.length > 2 ? ` +${services.length - 2} more` : ''}
        </p>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Zap className="h-3.5 w-3.5" />
          }
          Generate Proposal
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && proposals.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No proposals yet. Click Generate to create one.
          </CardContent>
        </Card>
      )}

      {proposals.map((p: {
        id: string; title: string; executive_summary: string;
        total_cost_min: number; total_cost_max: number; currency: string;
        timeline_weeks: number; status: string;
        milestones: { name: string; payment_percentage: number; duration_weeks: number }[];
        deliverables: string[];
      }) => (
        <Card key={p.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="truncate">{p.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`text-xs ${STATUS_COLORS[p.status] ?? ''}`} variant="outline">
                  {p.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  aria-label={expanded === p.id ? 'Collapse proposal' : 'Expand proposal'}
                >
                  {expanded === p.id
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />
                  }
                </Button>
              </div>
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatCurrency(p.total_cost_min, p.currency)} – {formatCurrency(p.total_cost_max, p.currency)}
              </span>
              <span>·</span>
              <span>{p.timeline_weeks} weeks</span>
            </div>
          </CardHeader>

          {expanded === p.id && (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{p.executive_summary}</p>

              {p.milestones?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Milestones</p>
                    <div className="space-y-2">
                      {p.milestones.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{m.name} ({m.duration_weeks}w)</span>
                          <Badge variant="secondary" className="text-xs">{m.payment_percentage}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {p.deliverables?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deliverables</p>
                    <ul className="space-y-1">
                      {p.deliverables.map((d, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary shrink-0">✓</span>{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex gap-2">
                {p.status === 'draft' && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => updateMutation.mutate({ id: p.id, status: 'sent' })}
                  >
                    <Send className="h-3.5 w-3.5" />Mark as Sent
                  </Button>
                )}
                {p.status === 'sent' && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => updateMutation.mutate({ id: p.id, status: 'accepted' })}
                    >
                      ✓ Accepted
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: p.id, status: 'rejected' })}
                    >
                      ✗ Rejected
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
