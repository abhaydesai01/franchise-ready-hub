import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AlertPriority } from '@/types/sales';
import { Bell, AlertTriangle, Info, X, MessageCircle, Phone, StickyNote, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAlertCounts, useAlerts, useDismissAlert, useRunAlertAction } from '@/hooks/useAlerts';
import { SkeletonCard } from '@/components/crm/SkeletonCard';

const priorityConfig: Record<AlertPriority, { icon: typeof Bell; label: string; color: string; bg: string; border: string }> = {
  critical: { icon: Bell, label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-600' },
  warning: { icon: AlertTriangle, label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-l-amber-500' },
  info: { icon: Info, label: 'Info', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-l-blue-500' },
};

const actionIcons: Record<string, typeof MessageCircle> = {
  send_wa: MessageCircle,
  book_call: Phone,
  add_note: StickyNote,
  view_lead: Eye,
  send_proposal: FileText,
};

export default function Alerts() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | AlertPriority>('all');
  const { data: alerts = [], isLoading } = useAlerts({ priority: filter });
  const { data: counts } = useAlertCounts();
  const dismiss = useDismissAlert();
  const runAction = useRunAlertAction();

  const dismissAlert = async (id: string) => {
    try {
      await dismiss.mutateAsync(id);
      toast.success('Alert dismissed');
    } catch {
      toast.error('Failed to dismiss alert');
    }
  };

  const handleAction = async (alert: (typeof alerts)[number]) => {
    if (alert.actionType === 'view_lead') {
      navigate(`/leads/${alert.leadId}`);
      return;
    }
    try {
      const res = await runAction.mutateAsync({ id: alert.id });
      toast.success(res.message || `${alert.actionLabel} completed for ${alert.leadName}`);
      if (alert.actionType === 'book_call') navigate('/calls');
      if (alert.actionType === 'send_proposal') navigate('/proposals');
      if (alert.actionType === 'add_note' || alert.actionType === 'send_wa') {
        navigate(`/leads/${alert.leadId}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to ${alert.actionLabel?.toLowerCase() ?? 'run action'}`;
      toast.error(msg);
    }
  };

  if (isLoading || !counts) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-10 w-64 rounded bg-brand-surface animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-brand-ink">Sales Alerts</h2>
          <p className="text-[13px] text-brand-muted">Leads that need your attention right now</p>
        </div>
        <div className="flex items-center gap-2">
          {counts.critical > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[12px] font-semibold animate-pulse">
              <Bell className="w-3.5 h-3.5" /> {counts.critical} Critical
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-brand-border pb-1">
        {(['all', 'critical', 'warning', 'info'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
              filter === tab ? 'text-brand-crimson border-b-2 border-brand-crimson' : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-surface font-medium">
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-brand-muted mx-auto mb-3 opacity-30" />
          <p className="text-[15px] font-semibold text-brand-ink">All clear! 🎉</p>
          <p className="text-[13px] text-brand-muted">No active alerts. Your pipeline is healthy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const config = priorityConfig[alert.priority];
            const PriorityIcon = config.icon;
            const ActionIcon = alert.actionType ? actionIcons[alert.actionType] || Eye : Eye;

            return (
              <div
                key={alert.id}
                className={`${config.bg} border border-transparent border-l-4 ${config.border} rounded-lg p-4 transition-all hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                    <PriorityIcon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-brand-ink">{alert.title}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color} ring-1 ring-current/20`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-brand-text mb-2">{alert.description}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/leads/${alert.leadId}`)}
                        className="text-[12px] text-brand-crimson hover:underline font-medium"
                      >
                        {alert.leadName} →
                      </button>
                      <span className="text-[11px] text-brand-muted">
                        {new Date(alert.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {alert.actionLabel && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(alert)}
                        disabled={runAction.isPending}
                        className="text-[11px] h-7 bg-brand-crimson hover:bg-brand-crimson-dk text-white gap-1"
                      >
                        <ActionIcon className="w-3 h-3" />
                        {alert.actionLabel}
                      </Button>
                    )}
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="p-1.5 hover:bg-white/80 rounded text-brand-muted hover:text-brand-text"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
