'use client';

import { useQuery } from '@tanstack/react-query';
import { getPipelineStats } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STAGE_COLORS: Record<string, string> = {
  discovered:  '#64748b',
  analyzing:   '#3b82f6',
  qualified:   '#8b5cf6',
  contacted:   '#f59e0b',
  meeting:     '#f97316',
  proposal:    '#ec4899',
  negotiation: '#6366f1',
  won:         '#22c55e',
  lost:        '#ef4444',
};

export function PipelineFunnel() {
  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: getPipelineStats,
    staleTime: 30_000,
  });

  const chartData = (data?.pipeline ?? []).filter((s: { count: number }) => s.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline Overview</CardTitle>
        <CardDescription>Leads at each sales stage this month</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
            No pipeline data yet. Start saving leads to see your funnel.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{ left: -20, right: 4, bottom: 4 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11 }}
                tickFormatter={(s: string) => s.charAt(0).toUpperCase() + s.slice(1)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, 'Leads']}
                labelFormatter={(label: string) =>
                  label.charAt(0).toUpperCase() + label.slice(1)
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {chartData.map((entry: { stage: string }) => (
                  <Cell
                    key={entry.stage}
                    fill={STAGE_COLORS[entry.stage] ?? '#94a3b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
