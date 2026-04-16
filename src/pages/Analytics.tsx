import { stageDropoffs, lossReasonStats, sourceConversions, responseTimeConversions, lostLeads } from '@/lib/salesMockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingDown, Target, Clock, Megaphone, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PIE_COLORS = ['#C8102E', '#D4882A', '#1A5CB8', '#1B8A4A', '#7C3AED', '#0891B2', '#DC2626', '#4B5563'];

export default function Analytics() {
  const navigate = useNavigate();
  const totalLost = lostLeads.length;
  const avgDaysInPipeline = Math.round(lostLeads.reduce((sum, l) => sum + l.daysInPipeline, 0) / totalLost);
  const highestLossStage = stageDropoffs.reduce((max, s) => s.lost > max.lost ? s : max, stageDropoffs[0]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingDown, label: 'Total Lost (90d)', value: totalLost + 98, color: '#C8102E', bg: '#FDEAED' },
          { icon: Target, label: 'Overall Conversion', value: '18.3%', color: '#1B8A4A', bg: '#EDFAF3' },
          { icon: Clock, label: 'Avg Days to Lost', value: `${avgDaysInPipeline}d`, color: '#D4882A', bg: '#FFF3E0' },
          { icon: AlertTriangle, label: 'Biggest Leak', value: highestLossStage.stage, color: '#C8102E', bg: '#FDEAED', sub: `${highestLossStage.lost} leads lost` },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <span className="text-[13px] text-brand-muted">{card.label}</span>
              </div>
              <p className="text-[28px] font-bold text-brand-ink">{card.value}</p>
              {'sub' in card && <p className="text-[12px] text-brand-muted mt-1">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Row 2: Pipeline Leakage Waterfall + Loss Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[15px] font-semibold text-brand-ink mb-1">Pipeline Leakage — Where Leads Drop Off</h3>
          <p className="text-[12px] text-brand-muted mb-4">Shows how many leads enter vs exit each stage</p>
          <div className="space-y-3">
            {stageDropoffs.map((stage, i) => (
              <div key={stage.stage}>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-brand-text w-36 text-right font-medium">{stage.stage}</span>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-7 bg-brand-surface rounded overflow-hidden relative">
                      <div className="h-full rounded bg-brand-crimson/20" style={{ width: `${(stage.entered / stageDropoffs[0].entered) * 100}%` }}>
                        <div className="h-full rounded" style={{
                          width: `${(stage.exited / stage.entered) * 100}%`,
                          backgroundColor: stage.conversionRate >= 80 ? '#1B8A4A' : stage.conversionRate >= 60 ? '#D4882A' : '#C8102E',
                        }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-36">
                    <span className="text-[12px] font-semibold text-brand-ink">{stage.entered}→{stage.exited}</span>
                    {stage.lost > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">-{stage.lost}</span>
                    )}
                  </div>
                </div>
                {i < stageDropoffs.length - 1 && stage.lost > 0 && (
                  <div className="flex items-center gap-3 ml-36 pl-3 py-0.5">
                    <ArrowRight className="w-3 h-3 text-brand-muted rotate-90" />
                    <span className="text-[10px] text-red-500 font-medium">{100 - stage.conversionRate}% lost — avg {stage.avgDaysInStage}d in stage</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[15px] font-semibold text-brand-ink mb-1">Why Leads Are Lost</h3>
          <p className="text-[12px] text-brand-muted mb-4">Top reasons for pipeline attrition</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={lossReasonStats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" stroke="none">
                {lossReasonStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} leads`, 'Lost']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {lossReasonStats.slice(0, 5).map((reason, i) => (
              <div key={reason.reason} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-[12px] text-brand-text flex-1">{reason.label}</span>
                <span className="text-[12px] font-semibold text-brand-ink">{reason.count}</span>
                <span className="text-[10px] text-brand-muted">({reason.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Source Performance + Response Time */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-brand-crimson" />
            <h3 className="text-[15px] font-semibold text-brand-ink">Conversion by Source</h3>
          </div>
          <p className="text-[12px] text-brand-muted mb-4">Which channels bring leads that actually convert?</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-2 text-[11px] uppercase text-brand-muted font-semibold">Source</th>
                  <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Leads</th>
                  <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Signed</th>
                  <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Conv %</th>
                  <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Avg Score</th>
                  <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">CPL</th>
                </tr>
              </thead>
              <tbody>
                {sourceConversions.map(src => (
                  <tr key={src.source} className="border-b border-brand-border/50 hover:bg-brand-surface">
                    <td className="py-2.5 font-medium text-brand-ink">{src.source}</td>
                    <td className="py-2.5 text-right text-brand-text">{src.leads}</td>
                    <td className="py-2.5 text-right text-brand-text">{src.signed}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-semibold ${src.conversionRate >= 20 ? 'text-green-600' : src.conversionRate >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {src.conversionRate}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-brand-text">{src.avgScore}</td>
                    <td className="py-2.5 text-right text-brand-text">{src.avgCPL > 0 ? `₹${src.avgCPL}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-brand-crimson" />
            <h3 className="text-[15px] font-semibold text-brand-ink">Speed to Lead</h3>
          </div>
          <p className="text-[12px] text-brand-muted mb-4">Faster response = higher conversion</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={responseTimeConversions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} unit="%" />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
              <Bar dataKey="conversionRate" fill="#C8102E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-[12px] text-amber-800">
              💡 <strong>Insight:</strong> Leads contacted within 30 min convert at 34% vs 0% for 4+ hrs. Speed is everything.
            </p>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Lost Leads */}
      <div className="bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Recently Lost Leads</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left py-2 text-[11px] uppercase text-brand-muted font-semibold">Name</th>
                <th className="text-left py-2 text-[11px] uppercase text-brand-muted font-semibold">Lost At</th>
                <th className="text-left py-2 text-[11px] uppercase text-brand-muted font-semibold">Reason</th>
                <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Score</th>
                <th className="text-right py-2 text-[11px] uppercase text-brand-muted font-semibold">Days in Pipeline</th>
                <th className="text-left py-2 text-[11px] uppercase text-brand-muted font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {lostLeads.map(lead => (
                <tr key={lead.leadId} className="border-b border-brand-border/50 hover:bg-brand-surface">
                  <td className="py-2.5 font-medium text-brand-ink">{lead.leadName}</td>
                  <td className="py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-text">{lead.lostAtStage}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">{lead.reasonLabel}</span>
                    {lead.competitorName && <span className="text-[11px] text-brand-muted ml-1">({lead.competitorName})</span>}
                  </td>
                  <td className="py-2.5 text-right text-brand-text">{lead.score}</td>
                  <td className="py-2.5 text-right text-brand-text">{lead.daysInPipeline}d</td>
                  <td className="py-2.5 text-[12px] text-brand-muted max-w-[200px] truncate">{lead.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
