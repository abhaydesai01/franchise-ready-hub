import type { Lead } from '@/types';
import { ScoreBadge } from './ScoreBadge';
import { TrackPill } from './TrackPill';
import { StagePill } from './StagePill';
import { MoreVertical, MessageCircle } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onMenuAction?: (action: string, lead: Lead) => void;
  isDragging?: boolean;
}

export function LeadCard({ lead, onClick, onMenuAction, isDragging }: LeadCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-brand-border p-[14px] cursor-pointer transition-all hover:border-brand-crimson hover:shadow-md ${isDragging ? 'shadow-lg opacity-90 rotate-1' : ''}`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[15px] font-semibold text-brand-ink truncate">{lead.name}</span>
        <ScoreBadge score={lead.score} />
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle className="w-3 h-3 text-brand-muted" />
        <span className="text-[12px] text-brand-muted">{lead.phone}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <TrackPill track={lead.track} />
        <StagePill stage={lead.stage} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-brand-muted">{lead.lastActivityType} {lead.lastActivity}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-brand-muted">{lead.stageDuration}d here</span>
          <DropdownMenu>
            <DropdownMenuTrigger onClick={e => e.stopPropagation()} className="p-1 hover:bg-brand-surface rounded">
              <MoreVertical className="w-3.5 h-3.5 text-brand-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-brand-border">
              {['View Profile', 'Move Stage', 'Book Discovery Call', 'Log Note', 'Send WhatsApp', 'Mark as Dead'].map(action => (
                <DropdownMenuItem key={action} onClick={(e) => { e.stopPropagation(); onMenuAction?.(action, lead); }}
                  className="text-[13px] cursor-pointer">
                  {action}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
