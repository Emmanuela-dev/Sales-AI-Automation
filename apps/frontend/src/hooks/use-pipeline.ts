import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPipeline, updateLead } from '@/lib/api';
import { toast } from './use-toast';

export function usePipeline() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pipeline'],
    queryFn: getPipeline,
  });

  const moveLead = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateLead(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast({ title: 'Failed to move lead', variant: 'destructive' });
    },
  });

  return { ...query, moveLead };
}
