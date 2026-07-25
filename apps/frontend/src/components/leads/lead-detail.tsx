'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLead, getAnalysis, getOutreach, generateOutreach,
  getProposals, generateProposal, getActivities, updateLead,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getStatusColor, getScoreColor, formatCurrency, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Globe, Phone, Mail, MapPin, Star, Zap,
  CheckCircle2, XCircle, Loader2, FileText, MessageSquare,
  Activity, TrendingUp, Building2,
} from 'lucide-react';
import { LeadStatusSelect } from './lead-status-select';
import { OutreachPanel } from './outreach-panel';
import { ProposalPanel } from './proposal-panel';
import { ActivityFeed } from './activity-feed';

export function LeadDetail({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => getLead(leadId),
  });

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', leadData?.lead?.business_id],
    queryFn: () => getAnalysis(leadData!.lead.business_id),
    enabled: !!leadData?.lead?.business_id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateLead(leadId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast({ title: 'Status updated' });
    },
  });

  if (isLoading) return <LeadDetailSkeleton />;
  if (!leadData?.lead) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Lead not found.</p>
      </div>
    );
  }

  const { lead } = leadData;
  const biz = lead.businesses;
  const analysis = analysisData?.analysis;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/leads">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Leads
        </Link>
      </Button>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{biz?.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{biz?.industry}</span>
            <span>·</span>
            <MapPin className="h-3 w-3" aria-hidden="true" />
            <span>{biz?.city}{biz?.country ? `, ${biz.country}` : ''}</span>
            {biz?.google_rating && (
              <>
                <span>·</span>
                <Star className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                <span>{biz.google_rating} ({biz.google_reviews_count} reviews)</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lead.opportunity_score != null && (
            <div className="text-center">
              <p className={`text-4xl font-bold ${getScoreColor(lead.opportunity_score)}`}>
                {lead.opportunity_score}
              </p>
              <p className="text-xs text-muted-foreground">Score / 100</p>
            </div>
          )}
          <LeadStatusSelect
            currentStatus={lead.status}
            onStatusChange={status => statusMutation.mutate(status)}
            loading={statusMutation.isPending}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="analysis">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="analysis" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />Website
              </TabsTrigger>
              <TabsTrigger value="outreach" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />Outreach
              </TabsTrigger>
              <TabsTrigger value="proposals" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />Proposals
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="mt-4">
              <WebsiteAnalysisPanel analysis={analysis} businessId={biz?.id} website={biz?.website} />
            </TabsContent>
            <TabsContent value="outreach" className="mt-4">
              <OutreachPanel leadId={leadId} />
            </TabsContent>
            <TabsContent value="proposals" className="mt-4">
              <ProposalPanel leadId={leadId} industry={biz?.industry} />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <ActivityFeed leadId={leadId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right — Sidebar */}
        <div className="space-y-4">
          <ContactCard biz={biz} />
          {lead.score_reasons?.length > 0 && (
            <ScoreCard score={lead.opportunity_score} reasons={lead.score_reasons} />
          )}
          {lead.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>Created {timeAgo(lead.created_at)}</p>
              <p>Updated {timeAgo(lead.updated_at)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WebsiteAnalysisPanel({
  analysis,
  businessId,
  website,
}: {
  analysis: Record<string, unknown> | null | undefined;
  businessId?: string;
  website?: string;
}) {
  const queryClient = useQueryClient();
  const triggerMutation = useMutation({
    mutationFn: () =>
      import('@/lib/api').then(m =>
        m.triggerAnalysis({ business_id: businessId!, url: website! })
      ),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['analysis', businessId] }), 5000);
      toast({ title: 'Analysis queued', description: 'Results will appear in a few seconds.' });
    },
  });

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {website ? 'No analysis yet.' : 'This business has no website.'}
          </p>
          {website && businessId && (
            <Button
              size="sm"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                : <Zap className="h-3.5 w-3.5 mr-1" />
              }
              Run Website Analysis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const score = analysis.score as number;
  const checks = [
    { label: 'HTTPS / Secure', value: analysis.has_https as boolean },
    { label: 'Mobile Responsive', value: analysis.is_mobile_responsive as boolean },
    { label: 'Booking Form', value: analysis.has_booking_form as boolean },
    { label: 'Contact Form', value: analysis.has_contact_form as boolean },
    { label: 'SEO Meta Tags', value: analysis.has_seo_meta as boolean },
    { label: 'Analytics Tracking', value: analysis.has_analytics as boolean },
    { label: 'Live Chat', value: analysis.has_live_chat as boolean },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Website Score</p>
              <p className="text-xs text-muted-foreground">{analysis.url as string}</p>
            </div>
            <p className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}<span className="text-base font-normal text-muted-foreground">/100</span></p>
          </div>
          <Progress value={score} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Checks</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {checks.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                {value
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                }
                <span className={value ? '' : 'text-muted-foreground'}>{label}</span>
              </div>
            ))}
          </div>
          {(analysis.tech_stack as string[])?.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-1">
                {(analysis.tech_stack as string[]).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(analysis.recommendations as string[])?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recommendations</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(analysis.recommendations as string[]).map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-orange-500 shrink-0 font-bold">→</span>
                  <span className="text-muted-foreground">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContactCard({ biz }: { biz: Record<string, unknown> }) {
  const phone = biz?.phone as string | undefined;
  const email = biz?.email as string | undefined;
  const website = biz?.website as string | undefined;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <a href={`tel:${phone}`} className="hover:text-foreground">{phone}</a>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <a href={`mailto:${email}`} className="hover:text-foreground truncate">{email}</a>
          </div>
        )}
        {website && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground truncate text-primary">
              {website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {!phone && !email && !website && (
          <p className="text-xs text-muted-foreground">No contact info available.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({ score, reasons }: { score?: number; reasons: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          Why This Score
          {score != null && (
            <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
              {r}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function LeadDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl">
      <Skeleton className="h-8 w-24" />
      <div className="flex justify-between">
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-72" /></div>
        <Skeleton className="h-12 w-24" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
