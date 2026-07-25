'use client';

import { usePipeline } from '@/hooks/use-pipeline';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { getScoreColor } from '@/lib/utils';
import Link from 'next/link';
import { Building2, Globe, AlertCircle, GripVertical } from 'lucide-react';

const STAGES = [
  { key: 'discovered',  label: 'Discovered',  color: 'border-t-slate-400',    header: 'bg-slate-50 dark:bg-slate-900' },
  { key: 'qualified',   label: 'Qualified',   color: 'border-t-purple-400',   header: 'bg-purple-50 dark:bg-purple-950' },
  { key: 'contacted',   label: 'Contacted',   color: 'border-t-yellow-400',   header: 'bg-yellow-50 dark:bg-yellow-950' },
  { key: 'meeting',     label: 'Meeting',     color: 'border-t-orange-400',   header: 'bg-orange-50 dark:bg-orange-950' },
  { key: 'proposal',    label: 'Proposal',    color: 'border-t-pink-400',     header: 'bg-pink-50 dark:bg-pink-950' },
  { key: 'negotiation', label: 'Negotiation', color: 'border-t-indigo-400',   header: 'bg-indigo-50 dark:bg-indigo-950' },
  { key: 'won',         label: '✓ Won',        color: 'border-t-green-500',    header: 'bg-green-50 dark:bg-green-950' },
];

interface PipelineLead {
  id: string;
  status: string;
  opportunity_score?: number;
  businesses: {
    name: string;
    industry: string;
    city: string;
    website?: string;
  };
}

export function PipelineBoard() {
  const { data, isLoading, moveLead } = usePipeline();
  const pipeline: Record<string, PipelineLead[]> = data?.pipeline ?? {};

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(s => (
          <div key={s.key} className="flex-shrink-0 w-52">
            <Skeleton className="h-8 w-full rounded-lg mb-2" />
            <Skeleton className="h-24 w-full rounded-lg mb-2" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('lead_id');
    if (leadId) {
      moveLead.mutate({ id: leadId, status: targetStage });
    }
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4 items-start"
      role="region"
      aria-label="Sales pipeline kanban board"
    >
      {STAGES.map(stage => {
        const leads = pipeline[stage.key] ?? [];

        return (
          <div
            key={stage.key}
            className="flex-shrink-0 w-52 flex flex-col rounded-xl border border-t-4 overflow-hidden"
            style={{ borderTopColor: stage.color.includes('slate') ? '#94a3b8'
              : stage.color.includes('purple') ? '#c084fc'
              : stage.color.includes('yellow') ? '#facc15'
              : stage.color.includes('orange') ? '#fb923c'
              : stage.color.includes('pink')   ? '#f472b6'
              : stage.color.includes('indigo') ? '#818cf8'
              : '#4ade80' }}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, stage.key)}
          >
            {/* Column header */}
            <div className={`px-3 py-2.5 ${stage.header} flex items-center justify-between`}>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {stage.label}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-[1.25rem] flex items-center justify-center">
                {leads.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 min-h-[120px] bg-muted/20">
              {leads.length === 0 && (
                <div className="flex flex-col items-center justify-center h-16 text-xs text-muted-foreground/50 gap-1">
                  <Building2 className="h-4 w-4" />
                  <span>Empty</span>
                </div>
              )}

              {leads.map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('lead_id', lead.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="group"
                >
                  <Card className="shadow-none hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-border/60">
                    <CardContent className="p-3 space-y-2">
                      {/* Grip + name */}
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-xs font-medium leading-tight hover:text-primary transition-colors line-clamp-2"
                            onClick={e => e.stopPropagation()}
                          >
                            {lead.businesses?.name}
                          </Link>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {lead.businesses?.industry} · {lead.businesses?.city}
                          </p>
                        </div>
                      </div>

                      {/* Score bar */}
                      {lead.opportunity_score != null && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Score</span>
                            <span className={`text-[10px] font-bold ${getScoreColor(lead.opportunity_score)}`}>
                              {lead.opportunity_score}
                            </span>
                          </div>
                          <Progress value={lead.opportunity_score} className="h-1" />
                        </div>
                      )}

                      {/* Website indicator */}
                      <div className="flex items-center gap-1">
                        {lead.businesses?.website ? (
                          <div className="flex items-center gap-1 text-[10px] text-green-600">
                            <Globe className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>Has website</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>No website</span>
                          </div>
                        )}
                      </div>

                      {/* Quick move — next stage only */}
                      {(() => {
                        const currentIdx = STAGES.findIndex(s => s.key === stage.key);
                        const nextStage = STAGES[currentIdx + 1];
                        if (!nextStage || stage.key === 'won') return null;
                        return (
                          <button
                            className="w-full text-[10px] text-muted-foreground hover:text-foreground border border-border/60 rounded px-2 py-0.5 hover:bg-accent transition-colors mt-1"
                            onClick={() => moveLead.mutate({ id: lead.id, status: nextStage.key })}
                            title={`Move to ${nextStage.label}`}
                          >
                            → Move to {nextStage.label}
                          </button>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
