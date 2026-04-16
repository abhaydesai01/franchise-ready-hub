import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, KanbanSquare, Users, Phone, FileText, Zap,
  UserCheck, Settings, LogOut, Search, Plus, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationDrawer } from '@/components/crm/NotificationDrawer';
import { AddLeadModal } from '@/components/crm/AddLeadModal';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: KanbanSquare, label: 'Pipeline', path: '/pipeline' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: Phone, label: 'Discovery Calls', path: '/calls' },
  { icon: FileText, label: 'Proposals', path: '/proposals' },
  { icon: Zap, label: 'Automation', path: '/automation' },
  { icon: UserCheck, label: 'Clients', path: '/clients' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/leads': 'Leads',
  '/calls': 'Discovery Calls',
  '/proposals': 'Proposals',
  '/automation': 'Automation',
  '/clients': 'Clients',
  '/settings': 'Settings',
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPath = '/' + location.pathname.split('/')[1];
  const pageTitle = pageTitles[currentPath] || 'Franchise Ready';

  return (
    <div className="flex min-h-screen bg-brand-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[220px] bg-brand-sidebar flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-2">
          <span className="text-[14px] font-bold text-white">Franchise</span>
          <span className="text-[14px] font-bold text-brand-crimson">Ready</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-crimson text-white">CRM</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(item => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 h-10 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] transition-colors ${
                  isActive
                    ? 'text-white bg-brand-crimson/10 border-l-[3px] border-brand-crimson'
                    : 'text-white/70 hover:text-white/90 hover:bg-white/5 border-l-[3px] border-transparent'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom user */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-crimson flex items-center justify-center text-white text-[12px] font-semibold">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white font-medium truncate">Arjun Mehta</p>
              <p className="text-[10px] text-white/50">Admin</p>
            </div>
            <button className="p-1 hover:bg-white/10 rounded" onClick={() => navigate('/login')}>
              <LogOut className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-brand-border flex items-center px-4 gap-4 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-brand-surface rounded">
            <Menu className="w-5 h-5 text-brand-text" />
          </button>
          <h1 className="text-[18px] font-semibold text-brand-ink">{pageTitle}</h1>
          <div className="flex-1 flex justify-center max-w-[280px] mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <Input
                placeholder="Search leads..."
                className="pl-9 h-9 bg-brand-surface border-brand-border text-[13px] focus:border-brand-crimson focus:ring-brand-crimson/10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationDrawer />
            <Button onClick={() => setAddLeadOpen(true)}
              className="bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg px-4 h-9 text-[13px] font-medium gap-1.5">
              <Plus className="w-4 h-4" /> Add Lead
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      <AddLeadModal open={addLeadOpen} onOpenChange={setAddLeadOpen} />
    </div>
  );
}
