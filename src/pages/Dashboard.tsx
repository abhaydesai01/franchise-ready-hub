import { useDashboard, useActivities } from '@/hooks/useDashboard';
import { Users, Clock, TrendingUp, Briefcase, Trophy, ArrowDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ActivityFeed } from '@/components/crm/ActivityFeed';
import { SkeletonCard } from '@/components/crm/SkeletonCard';
import { useNavigate } from 'react-router-dom';

const metricIcons = [Users, Clock, TrendingUp, Briefcase, Trophy];
const metricColors = ['#C8102E', '#D4882A', '#1B8A4A', '#1A5CB8', '#C8102E'];
const metricBgs = ['#FDEAED', '#FFF3E0', '#EDFAF3', '#E8F0FD', '#FDEAED'];

const agendaColors: Record<string, string> = {
  call: '#C8102E',
  proposal_followup: '#1A5CB8',
  wa_followup: '#1B8A4A',
  sequence_step: '#D4882A',
};

const agendaEmoji: Record<string, string> = {
  call: '📞',
  proposal_followup: '📄',
  wa_followup: '💬',
  sequence_step: '⚡',
};

const TRACK_COLORS = ['#D4882A', '#1B8A4A', '#1A5CB8'];

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard();
  const { data: activities = [] } = useActivities();
  const navigate = useNavigate();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const metricValues = [
    { label: 'Total Leads', value: stats.totalLeads, delta: stats.weeklyDeltas.totalLeads },
    { label: 'Not Ready', value: stats.notReady, delta: stats.weeklyDeltas.notReady },
    { label: 'Franchise Ready', value: stats.franchiseReady, delta: stats.weeklyDeltas.franchiseReady },
    { label: 'Recruitment Only', value: stats.recruitmentOnly, delta: stats.weeklyDeltas.recruitmentOnly },
    { label: 'Signed Clients', value: stats.signedClients, delta: stats.weeklyDeltas.signedClients },
  ];

  const trackData = [
    { name: 'Not Ready', value: stats.notReady },
    { name: 'Franchise Ready', value: stats.franchiseReady },
    { name: 'Recruitment Only', value: stats.recruitmentOnly },
  ];

  const maxFunnel = Math.max(...stats.funnel.map(f => f.count));

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricValues.map((m, i) => {
          const Icon = metricIcons[i];
          return (
            <div key={m.label} className="bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: metricBgs[i] }}>
                  <Icon className="w-5 h-5" style={{ color: metricColors[i] }} />
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.delta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {m.delta >= 0 ? '+' : ''}{m.delta} this week
                </span>
              </div>
              <p className="text-[32px] font-bold text-brand-ink">{m.value}</p>
              <p className="text-[13px] text-brand-muted">{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Row 2: Funnel + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Conversion funnel — this month</h3>
          <div className="space-y-3">
            {stats.funnel.map((stage, i) => {
              const opacity = 1 - i * 0.15;
              const nextCount = stats.funnel[i + 1]?.count;
              const dropOff = nextCount != null ? Math.round((1 - nextCount / stage.count) * 100) : null;
              return (
                <div key={stage.stage}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-brand-text w-32 text-right">{stage.stage}</span>
                    <div className="flex-1 h-8 bg-brand-surface rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(stage.count / maxFunnel) * 100}%`,
                          backgroundColor: '#C8102E',
                          opacity,
                        }}
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-brand-ink w-8">{stage.count}</span>
                  </div>
                  {dropOff != null && (
                    <div className="flex items-center gap-3 ml-32 pl-3 py-0.5">
                      <ArrowDown className="w-3 h-3 text-brand-muted" />
                      <span className="text-[11px] text-brand-muted">{dropOff}% drop</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-brand-ink">Today</h3>
            <span className="text-[12px] text-brand-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="space-y-2">
            {stats.todayAgenda.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(`/leads/${item.leadId}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-brand-surface transition-colors text-left"
                style={{ borderLeft: `3px solid ${agendaColors[item.type]}` }}
              >
                <span className="text-[16px]">{agendaEmoji[item.type]}</span>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-brand-ink">{item.leadName}</p>
                  <p className="text-[11px] text-brand-muted">{item.label}</p>
                </div>
                <span className="text-[12px] px-2 py-0.5 rounded bg-brand-surface text-brand-muted">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Activity + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Recent activity</h3>
          <ActivityFeed activities={activities.slice(0, 20)} onLeadClick={id => navigate(`/leads/${id}`)} />
        </div>

        <div className="lg:col-span-5 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Leads by track</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={trackData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  stroke="none"
                >
                  {trackData.map((_, i) => (
                    <Cell key={i} fill={TRACK_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[24px] font-bold text-brand-ink">{stats.totalLeads}</p>
                <p className="text-[11px] text-brand-muted">Total</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {trackData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TRACK_COLORS[i] }} />
                <span className="text-[13px] text-brand-text flex-1">{t.name}</span>
                <span className="text-[13px] font-medium text-brand-ink">{t.value}</span>
                <span className="text-[11px] text-brand-muted">({Math.round((t.value / stats.totalLeads) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
