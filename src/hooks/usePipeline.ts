import { useQuery } from '@tanstack/react-query';
import { fetchPipelineStages } from '@/lib/api';

export function usePipelineStages(track?: string) {
  return useQuery({
    queryKey: ['pipeline', 'stages', track ?? 'all'],
    queryFn: () => fetchPipelineStages(track),
  });
}
