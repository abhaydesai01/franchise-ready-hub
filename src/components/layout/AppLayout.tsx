import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, KanbanSquare, Users, Phone, FileText, Zap,
  UserCheck, Settings, LogOut, Search, Plus, Menu, X, Bell,
  BarChart3, CalendarDays, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationDrawer } from '@/components/crm/NotificationDrawer';
import { AddLeadModal } from '@/components/crm/AddLeadModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchAlertCounts } from '@/lib/api';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: KanbanSquare, label: 'Pipeline', path: '/pipeline' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Phone, label: 'Calls', path: '/calls' },
  { icon: FileText, label: 'Proposals', path: '/proposals' },
  { icon: Zap, label: 'Automation', path: '/automation' },
  { icon: UserCheck, label: 'Clients', path: '/clients' },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/leads': 'Leads',
  '/whatsapp': 'WhatsApp Inbox',
  '/alerts': 'Sales Alerts',
  '/analytics': 'Win/Loss Analytics',
  '/calls': 'Discovery Calls',
  '/proposals': 'Proposals',
  '/automation': 'Automation',
  '/clients': 'Clients',
  '/calendar': 'Calendar',
  '/settings': 'Settings',
};

/** Bottom bar on small screens: include Settings (many users never open the hamburger menu). */
const mobileTabItems = [
  navItems[0],
  navItems[1],
  navItems[2],
  navItems[3],
  navItems[10],
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPath = '/' + location.pathname.split('/')[1];
  const pageTitle = pageTitles[currentPath] || 'Franchise Ready';

  const { data: alertCounts } = useQuery({
    queryKey: ['alerts', 'counts'],
    queryFn: fetchAlertCounts,
    staleTime: 30_000,
  });
  const criticalAlertCount = alertCounts?.critical ?? 0;

  return (
    <div className="flex min-h-screen bg-brand-surface">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 bg-brand-sidebar flex flex-col transition-all
          ${sidebarOpen ? 'translate-x-0 w-[220px]' : '-translate-x-full w-[220px]'}
          md:translate-x-0 md:w-16
          xl:w-[220px]
        `}
      >
        <div className="h-16 flex items-center px-4 gap-2 xl:px-4 md:justify-center xl:justify-start">
          <span className="text-[14px] font-bold text-white hidden xl:inline">Franchise</span>
          <span className="text-[14px] font-bold text-brand-crimson hidden xl:inline">Ready</span>
          <span className="hidden xl:inline ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-crimson text-white">CRM</span>
          <span className="hidden md:flex xl:hidden w-8 h-8 rounded-lg bg-brand-crimson items-center justify-center text-white text-[11px] font-bold">FR</span>
          <span className="md:hidden text-[14px] font-bold text-white">Franchise</span>
          <span className="md:hidden text-[14px] font-bold text-brand-crimson">Ready</span>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5 md:px-1 xl:px-2">
          {navItems.map(item => {
            const isActive = currentPath === item.path;
            const isAlerts = item.path === '/alerts';
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`relative flex items-center gap-3 h-10 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] transition-colors
                      px-4 md:px-0 md:justify-center xl:px-4 xl:justify-start
                      ${isActive
                        ? 'text-white bg-brand-crimson/10 border-l-[3px] border-brand-crimson md:border-l-0 md:bg-brand-crimson/20 xl:border-l-[3px]'
                        : 'text-white/70 hover:text-white/90 hover:bg-white/5 border-l-[3px] border-transparent md:border-l-0 xl:border-l-[3px]'
                      }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="md:hidden xl:inline">{item.label}</span>
                    {/* Alert badge */}
                    {isAlerts && criticalAlertCount > 0 && (
                      <span className="absolute top-1 right-1 md:top-0.5 md:right-0.5 xl:static xl:ml-auto flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                        {criticalAlertCount}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="hidden md:block xl:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10 md:px-2 xl:px-4">
          <div className="flex items-center gap-3 md:justify-center xl:justify-start">
            <div className="w-8 h-8 rounded-full bg-brand-crimson flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">
              AM
            </div>
            <div className="flex-1 min-w-0 md:hidden xl:block">
              <p className="text-[12px] text-white font-medium truncate">Arjun Mehta</p>
              <p className="text-[10px] text-white/50">Admin</p>
            </div>
            <button className="p-1 hover:bg-white/10 rounded md:hidden xl:block" onClick={() => navigate('/login')}>
              <LogOut className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-brand-border flex items-center px-4 gap-4 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-brand-surface rounded">
            <Menu className="w-5 h-5 text-brand-text" />
          </button>
          <h1 className="text-[18px] font-semibold text-brand-ink">{pageTitle}</h1>
          <div className="flex-1 flex justify-center max-w-[280px] mx-auto hidden sm:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <Input
                placeholder="Search leads..."
                className="pl-9 h-9 bg-brand-surface border-brand-border text-[13px] focus:border-brand-crimson focus:ring-brand-crimson/10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Alert bell in header */}
            <button
              onClick={() => navigate('/alerts')}
              className="relative p-2 hover:bg-brand-surface rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5 text-brand-muted" />
              {criticalAlertCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {criticalAlertCount}
                </span>
              )}
            </button>
            <NotificationDrawer />
            <Button onClick={() => setAddLeadOpen(true)}
              className="bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg px-4 h-9 text-[13px] font-medium gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-brand-sidebar border-t border-white/10 flex items-center justify-around h-16 px-1">
        {mobileTabItems.map(item => {
          const isActive = currentPath === item.path;
          const isAlerts = item.path === '/alerts';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive ? 'text-brand-crimson' : 'text-white/60'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isAlerts && criticalAlertCount > 0 && (
                <span className="absolute top-2 right-1/4 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {criticalAlertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <AddLeadModal open={addLeadOpen} onOpenChange={setAddLeadOpen} />
    </div>
  );
}
