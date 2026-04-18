import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats, fetchActivities, fetchLossAnalytics } from '@/lib/api';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });
}

export function useActivities() {
  return useQuery({ queryKey: ['activities'], queryFn: fetchActivities });
}

export function useLossAnalytics() {
  return useQuery({ queryKey: ['analytics', 'loss-report'], queryFn: fetchLossAnalytics });
}
