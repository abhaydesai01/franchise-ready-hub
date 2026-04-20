import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { MessageCircle, RefreshCw, ArrowRight, Circle } from 'lucide-react';
import { fetchWhatsAppInbox, type WAInboxItem } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATE_LABELS: Record<string, string> = {
  WELCOME: 'Just started',
  Q_NAME: 'Asking name',
  Q_EMAIL: 'Asking email',
  Q_BRAND: 'Asking brand',
  Q_OUTLETS: 'Asking outlets',
  Q_CITY: 'Asking city',
  Q_SERVICE: 'Asking service',
  Q_SOPS: 'Asking SOPs',
  Q_GOAL: 'Asking goal',
  DATE_SELECT: 'Selecting date',
  SLOT_SELECT: 'Selecting slot',
  DONE: 'Completed',
};

const STATE_COLORS: Record<string, string> = {
  WELCOME: 'bg-gray-100 text-gray-600',
  Q_NAME: 'bg-blue-100 text-blue-700',
  Q_EMAIL: 'bg-blue-100 text-blue-700',
  Q_BRAND: 'bg-blue-100 text-blue-700',
  Q_OUTLETS: 'bg-blue-100 text-blue-700',
  Q_CITY: 'bg-blue-100 text-blue-700',
  Q_SERVICE: 'bg-purple-100 text-purple-700',
  Q_SOPS: 'bg-purple-100 text-purple-700',
  Q_GOAL: 'bg-purple-100 text-purple-700',
  DATE_SELECT: 'bg-amber-100 text-amber-700',
  SLOT_SELECT: 'bg-amber-100 text-amber-700',
  DONE: 'bg-green-100 text-green-700',
};

function ConversationCard({ item, onClick }: { item: WAInboxItem; onClick: () => void }) {
  const stateLabel = STATE_LABELS[item.state] ?? item.state;
  const stateColor = STATE_COLORS[item.state] ?? 'bg-gray-100 text-gray-600';
  const timeAgo = formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true });

  return (
    <div
      onClick={onClick}
      className="bg-white border border-brand-border rounded-[10px] p-4 hover:border-green-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-[13px] font-bold">
              {item.leadName.charAt(0).toUpperCase()}
            </div>
            {item.isActive && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
            )}
          </div>
          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-brand-ink truncate">{item.leadName}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stateColor}`}>
                {stateLabel}
              </span>
            </div>
            <p className="text-[12px] text-brand-muted mt-0.5">+{item.phone}</p>
            <p className="text-[12px] text-brand-ink mt-1 truncate max-w-[300px]">
              {item.lastMessageDirection === 'outbound' && (
                <span className="text-brand-muted mr-1">Freddy:</span>
              )}
              {item.lastMessage || '—'}
            </p>
          </div>
        </div>
        {/* Right meta */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-[11px] text-brand-muted whitespace-nowrap">{timeAgo}</span>
          <span className="text-[11px] text-brand-muted">{item.totalMessages} msgs</span>
          {item.leadId && (
            <ArrowRight className="w-4 h-4 text-brand-muted" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const { data = [], isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['whatsapp-inbox'],
    queryFn: fetchWhatsAppInbox,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const active = data.filter((c) => c.isActive);
  const done = data.filter((c) => !c.isActive);

  const handleClick = (item: WAInboxItem) => {
    if (item.leadId) navigate(`/leads/${item.leadId}?tab=whatsapp`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-brand-ink">WhatsApp Inbox</h1>
          <p className="text-[13px] text-brand-muted mt-0.5">
            Live Freddy bot conversations · auto-refreshes every 10s
            {dataUpdatedAt ? ` · updated ${format(new Date(dataUpdatedAt), 'h:mm:ss a')}` : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5 text-[12px] border-brand-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Conversations', value: data.length, color: 'text-brand-ink' },
          { label: 'Active Now', value: active.length, color: 'text-green-600' },
          { label: 'Completed', value: done.length, color: 'text-brand-muted' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-brand-border rounded-[10px] p-4 text-center">
            <p className={`text-[24px] font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[12px] text-brand-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-brand-border rounded-[10px] p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageCircle className="w-12 h-12 text-brand-muted mb-4" />
          <p className="text-[15px] font-semibold text-brand-ink">No conversations yet</p>
          <p className="text-[13px] text-brand-muted mt-1">
            Conversations will appear here as soon as someone messages your WhatsApp number.
          </p>
        </div>
      ) : (
        <>
          {/* Active conversations */}
          {active.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                <h2 className="text-[13px] font-semibold text-brand-ink uppercase tracking-wide">
                  Active Now ({active.length})
                </h2>
              </div>
              <div className="space-y-2">
                {active.map((item) => (
                  <ConversationCard key={item.sessionId} item={item} onClick={() => handleClick(item)} />
                ))}
              </div>
            </section>
          )}

          {/* Completed conversations */}
          {done.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />
                <h2 className="text-[13px] font-semibold text-brand-muted uppercase tracking-wide">
                  Completed ({done.length})
                </h2>
              </div>
              <div className="space-y-2">
                {done.map((item) => (
                  <ConversationCard key={item.sessionId} item={item} onClick={() => handleClick(item)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
