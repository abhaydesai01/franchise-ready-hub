import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markAllNotificationsRead } from '@/lib/api';

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}
