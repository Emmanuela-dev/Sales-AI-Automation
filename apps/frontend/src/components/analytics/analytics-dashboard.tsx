'use client';

import { useState } from 'react';
import { useAnalytics } from '@/hooks/use-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie,
} from 'recharts';
import {
  Building2, TrendingUp, Mail, Calendar, Trophy, DollarSign,
  ArrowUpRight, Percent,
} from 'lucide-react';

const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

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

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899'];

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState('month');
  const { stats, pipeline } = useAnalytics(period);

  const s = stats.data;
  const pipelineData = (pipeline.data?.pipeline ?? []).filter(
    (p: { count: number }) => p.count > 0
  );

  // Compute conversion rates between adjacent pipeline stages
  const conversionData = computeConversions(pipelineData);

  // Industry breakdown from pipeline (we approximate with mock until real data flows)
  const pieData = pipelineData.slice(0, 5).map(
    (p: { stage: string; count: number }, i: number) => ({
      name: p.stage.charAt(0).toUpperCase() + p.stage.slice(1),
      value: p.count,
      color: PIE_COLORS[i % PIE_COLORS.length],
    })
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Period Selector */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <Button
            key={p.key}
            variant={period === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={Building2}
          label="Businesses Found"
          value={formatNumber(s?.businesses_found ?? 0)}
          color="text-blue-500"
          bg="bg-blue-50 dark:bg-blue-950"
          loading={stats.isLoading}
        />
        <KpiCard
          icon={TrendingUp}
          label="High-Value Prospects"
          value={formatNumber(s?.high_value_prospects ?? 0)}
          color="text-purple-500"
          bg="bg-purple-50 dark:bg-purple-950"
          loading={stats.isLoading}
          hint="Score ≥ 75"
        />
        <KpiCard
          icon={Mail}
          label="Emails Sent"
          value={formatNumber(s?.emails_sent ?? 0)}
          color="text-yellow-500"
          bg="bg-yellow-50 dark:bg-yellow-950"
          loading={stats.isLoading}
        />
        <KpiCard
          icon={Calendar}
          label="Meetings Booked"
          value={formatNumber(s?.meetings_booked ?? 0)}
          color="text-orange-500"
          bg="bg-orange-50 dark:bg-orange-950"
          loading={stats.isLoading}
        />
        <KpiCard
          icon={Trophy}
          label="Clients Won"
          value={formatNumber(s?.clients_won ?? 0)}
          color="text-green-500"
          bg="bg-green-50 dark:bg-green-950"
          loading={stats.isLoading}
        />
        <KpiCard
          icon={DollarSign}
          label="Revenue"
          value={formatCurrency(s?.revenue_total ?? 0, s?.currency)}
          color="text-emerald-500"
          bg="bg-emerald-50 dark:bg-emerald-950"
          loading={stats.isLoading}
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline bar chart — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
            <CardDescription>Lead count at each sales stage</CardDescription>
          </CardHeader>
          <CardContent>
            {pipeline.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineData} margin={{ left: -16, right: 8 }}>
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(s: string) => s.charAt(0).toUpperCase() + s.slice(1)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Leads']}
                    labelFormatter={(l: string) => l.charAt(0).toUpperCase() + l.slice(1)}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {pipelineData.map((entry: { stage: string }) => (
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

        {/* Pie chart — stage distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage Distribution</CardTitle>
            <CardDescription>Where your leads are right now</CardDescription>
          </CardHeader>
          <CardContent>
            {pipeline.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : pieData.length === 0 ? (
              <EmptyChart message="No leads yet" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry: { color: string }, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
                  {pieData.map((entry: { name: string; color: string; value: number }) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: entry.color }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Conversion rate line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Rates</CardTitle>
            <CardDescription>Stage-to-stage conversion percentages</CardDescription>
          </CardHeader>
          <CardContent>
            {pipeline.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : conversionData.length === 0 ? (
              <EmptyChart message="Need more pipeline data" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={conversionData} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Conversion']} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Summary</CardTitle>
            <CardDescription>Key metrics for {period}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="space-y-0 divide-y">
                {[
                  {
                    label: 'Discovery → Qualified',
                    value: rate(s?.businesses_found, s?.high_value_prospects),
                    icon: TrendingUp,
                  },
                  {
                    label: 'Qualified → Contacted',
                    value: rate(s?.high_value_prospects, s?.emails_sent),
                    icon: Mail,
                  },
                  {
                    label: 'Contacted → Meeting',
                    value: rate(s?.emails_sent, s?.meetings_booked),
                    icon: Calendar,
                  },
                  {
                    label: 'Meeting → Won',
                    value: rate(s?.meetings_booked, s?.clients_won),
                    icon: Trophy,
                  },
                  {
                    label: 'Revenue per Win',
                    value: s?.clients_won
                      ? formatCurrency((s.revenue_total ?? 0) / s.clients_won, s.currency)
                      : '—',
                    icon: DollarSign,
                    isCurrency: true,
                  },
                ].map(({ label, value, icon: Icon, isCurrency }) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold">{value}</span>
                      {!isCurrency && typeof value === 'string' && value !== '—' && (
                        <Percent className="h-3 w-3 text-muted-foreground" />
                      )}
                      {!isCurrency && (
                        <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Stage Detail Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage Breakdown</CardTitle>
          <CardDescription>Detailed view of each pipeline stage</CardDescription>
        </CardHeader>
        <CardContent>
          {pipeline.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Stage breakdown table">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Stage</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Leads</th>
                    <th className="text-right py-2 font-medium text-muted-foreground hidden sm:table-cell">% of Total</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground hidden md:table-cell">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {(pipeline.data?.pipeline ?? []).map((row: { stage: string; count: number }) => {
                    const total = (pipeline.data?.pipeline ?? []).reduce(
                      (sum: number, r: { count: number }) => sum + r.count,
                      0
                    );
                    const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                    return (
                      <tr key={row.stage} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: STAGE_COLORS[row.stage] ?? '#94a3b8' }}
                            />
                            <Badge
                              variant="outline"
                              className="capitalize text-xs font-normal"
                            >
                              {row.stage}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-semibold">
                          {row.count}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                          {pct}%
                        </td>
                        <td className="py-2.5 pl-4 hidden md:table-cell">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: STAGE_COLORS[row.stage] ?? '#94a3b8',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  loading,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  loading: boolean;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
          <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16 mb-1" />
        ) : (
          <p className="text-2xl font-bold leading-none">{value}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function rate(total: number | undefined, subset: number | undefined): string {
  if (!total || !subset) return '—';
  return String(Math.round((subset / total) * 100));
}

function computeConversions(
  stages: { stage: string; count: number }[]
): { label: string; rate: number }[] {
  if (stages.length < 2) return [];
  const result = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    if (from.count === 0) continue;
    result.push({
      label: `${from.stage.slice(0, 4)}→${to.stage.slice(0, 4)}`,
      rate: Math.round((to.count / from.count) * 100),
    });
  }
  return result;
}
