import { Suspense } from 'react';
import { DashboardStats } from '@/components/dashboard/stats';
import { RecentLeads } from '@/components/dashboard/recent-leads';
import { PipelineFunnel } from '@/components/dashboard/pipeline-funnel';
import { FollowUpAlerts } from '@/components/dashboard/follow-up-alerts';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your sales intelligence overview
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            <PipelineFunnel />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            <FollowUpAlerts />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <RecentLeads />
      </Suspense>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
