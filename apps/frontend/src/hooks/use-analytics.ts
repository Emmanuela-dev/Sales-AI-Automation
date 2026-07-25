import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getPipelineStats } from '@/lib/api';

export function useAnalytics(period = 'month') {
  const stats = useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => getDashboardStats(period),
    staleTime: 60_000,
  });

  const pipeline = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: getPipelineStats,
    staleTime: 60_000,
  });

  return { stats, pipeline };
}
