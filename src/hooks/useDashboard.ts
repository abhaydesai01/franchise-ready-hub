import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats, fetchActivities } from '@/lib/api';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });
}

export function useActivities() {
  return useQuery({ queryKey: ['activities'], queryFn: fetchActivities });
}
