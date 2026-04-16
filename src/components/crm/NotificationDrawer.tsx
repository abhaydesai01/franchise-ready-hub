import { Bell, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useNotifications, useMarkAllRead } from '@/hooks/useNotifications';
import { formatRelativeTime, getActivityIcon } from '@/lib/utils';
import { UserPlus, ArrowRight, MessageCircle, Mail, Phone, FileText, Trophy, StickyNote, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const iconMap: Record<string, React.ElementType> = {
  UserPlus, ArrowRight, MessageCircle, Mail, Phone, FileText, Trophy, StickyNote, Circle,
};

export function NotificationDrawer() {
  const { data: notifications = [] } = useNotifications();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-brand-surface transition-colors">
          <Bell className="w-5 h-5 text-brand-muted" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand-crimson text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-[560px] bg-white border-brand-border p-0">
        <SheetHeader className="px-6 py-4 border-b border-brand-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[18px] font-semibold text-brand-ink">Notifications</SheetTitle>
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}
              className="text-[12px] text-brand-crimson hover:text-brand-crimson-dk">
              Mark all read
            </Button>
          </div>
        </SheetHeader>
        <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
          {notifications.map(notif => {
            const { icon, bgColor } = getActivityIcon(notif.type);
            const Icon = iconMap[icon] || Circle;
            const isWhiteIcon = notif.type === 'client_signed';
            return (
              <button
                key={notif.id}
                onClick={() => notif.leadId && navigate(`/leads/${notif.leadId}`)}
                className={`w-full flex items-start gap-3 px-6 py-3 text-left hover:bg-brand-surface transition-colors ${!notif.read ? 'bg-brand-crimson-lt/30' : ''}`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: bgColor }}>
                  <Icon className="w-4 h-4" style={{ color: isWhiteIcon ? '#FFF' : '#1A1A1A' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] text-brand-text ${!notif.read ? 'font-medium' : ''}`}>
                    {notif.description}
                  </p>
                  <p className="text-[11px] text-brand-muted mt-0.5">
                    {formatRelativeTime(notif.timestamp)}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-brand-crimson mt-1.5 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
