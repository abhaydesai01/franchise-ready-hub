import { UserPlus, ArrowRight, MessageCircle, Mail, Phone, FileText, Trophy, StickyNote, Circle } from 'lucide-react';
import { formatRelativeTime, getActivityIcon } from '@/lib/utils';
import type { Activity } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  UserPlus, ArrowRight, MessageCircle, Mail, Phone, FileText, Trophy, StickyNote, Circle,
};

interface ActivityItemProps {
  activity: Activity;
  onLeadClick?: (leadId: string) => void;
}

export function ActivityItem({ activity, onLeadClick }: ActivityItemProps) {
  const { icon, bgColor } = getActivityIcon(activity.type);
  const Icon = iconMap[icon] || Circle;
  const isWhiteIcon = activity.type === 'client_signed';

  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <Icon className="w-4 h-4" style={{ color: isWhiteIcon ? '#FFFFFF' : '#1A1A1A' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-brand-text">
          {activity.description}
        </p>
        {activity.leadName && onLeadClick && (
          <button
            onClick={() => onLeadClick(activity.leadId)}
            className="text-[12px] text-brand-crimson hover:underline font-medium"
          >
            View {activity.leadName}
          </button>
        )}
      </div>
      <span className="text-[12px] text-brand-muted whitespace-nowrap">
        {formatRelativeTime(activity.timestamp)}
      </span>
    </div>
  );
}

interface ActivityFeedProps {
  activities: Activity[];
  onLeadClick?: (leadId: string) => void;
}

export function ActivityFeed({ activities, onLeadClick }: ActivityFeedProps) {
  return (
    <div className="divide-y divide-brand-border">
      {activities.map(activity => (
        <ActivityItem key={activity.id} activity={activity} onLeadClick={onLeadClick} />
      ))}
    </div>
  );
}
