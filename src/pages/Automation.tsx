import { useState } from 'react';
import {
  useSequences,
  useAutomationLogs,
  useReEngagementRules,
  useReEngagementLogs,
  useUpdateReEngagementRule,
} from '@/hooks/useAutomation';
import { TrackPill } from '@/components/crm/TrackPill';
import { SkeletonTable, SkeletonCard } from '@/components/crm/SkeletonCard';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { getTrackColors, getStatusColors } from '@/lib/utils';
import { GripVertical, Trash2, Plus, Zap, MessageSquare, Phone, Mail, UserPlus, CheckCircle2, XCircle, Clock, ArrowRight, TrendingUp, AlertTriangle, Eye, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AutomationSequence } from '@/types';
import type { ReEngagementRule, ReEngagementLog } from '@/types/sales';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  send_wa_template: <MessageSquare className="w-3.5 h-3.5 text-green-600" />,
  schedule_call: <Phone className="w-3.5 h-3.5 text-blue-600" />,
  send_email: <Mail className="w-3.5 h-3.5 text-purple-600" />,
  assign_to_senior: <UserPlus className="w-3.5 h-3.5 text-amber-600" />,
};

const OUTCOME_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  responded: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Responded', color: 'bg-green-50 text-green-700' },
  converted: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Converted', color: 'bg-blue-50 text-blue-700' },
  no_response: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'No Response', color: 'bg-red-50 text-red-700' },
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending', color: 'bg-amber-50 text-amber-700' },
};

const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-amber-400',
};

export default function Automation() {
  const navigate = useNavigate();
  const { data: sequences = [], isLoading: loadingSeq } = useSequences();
  const { data: logs = [], isLoading: loadingLogs } = useAutomationLogs();
  const { data: rules = [], isLoading: loadingRules } = useReEngagementRules();
  const { data: reLogs = [], isLoading: loadingReLogs } = useReEngagementLogs();
  const updateRuleMutation = useUpdateReEngagementRule();
  const [activeTab, setActiveTab] = useState<'sequences' | 'logs' | 'reengagement' | 'reengagement_logs'>('sequences');
  const [editingSeq, setEditingSeq] = useState<AutomationSequence | null>(null);
  const [viewingRule, setViewingRule] = useState<ReEngagementRule | null>(null);

  const toggleRule = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    updateRuleMutation.mutate({ id, enabled: !rule.enabled });
  };

  const tabs = [
    { key: 'sequences' as const, label: 'Sequences' },
    { key: 'logs' as const, label: 'Activity Log' },
    { key: 'reengagement' as const, label: 'Re-engagement Rules' },
    { key: 'reengagement_logs' as const, label: 'Trigger History' },
  ];

  return (
    <div className="flex gap-6">
      {/* Left tabs */}
      <div className="w-52 flex-shrink-0 space-y-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${activeTab === tab.key ? 'bg-brand-crimson-lt text-brand-crimson' : 'text-brand-muted hover:bg-brand-surface'}`}>
            {tab.key === 'reengagement' && <Zap className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        <div className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2.5 text-[12px] text-brand-muted flex flex-wrap items-center gap-2">
          <PhoneCall className="w-3.5 h-3.5 text-brand-crimson shrink-0" />
          <span>
            Voice automations in this list use the phone channel. Outbound <strong>Optimizer</strong> call logs,
            transcripts, and manual dispatch are on each lead: open <strong>Leads</strong> → select a person →
            <strong> Dispatch call</strong> or the <strong>Voice</strong> tab.
          </span>
          <Button variant="link" className="h-auto p-0 text-[12px] text-brand-crimson" onClick={() => navigate('/leads')}>
            Go to Leads
          </Button>
        </div>
        {/* === Sequences === */}
        {activeTab === 'sequences' && (
          <div className="space-y-3">
            {loadingSeq ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />) : sequences.map(seq => {
              const tc = getTrackColors(seq.track);
              return (
                <div key={seq.id} className="bg-white rounded-[10px] border border-brand-border p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  style={{ borderLeft: `4px solid ${tc.border}` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-semibold text-brand-ink">{seq.name}</h3>
                        <TrackPill track={seq.track} />
                      </div>
                      <p className="text-[12px] text-brand-muted">
                        {seq.steps.length} steps · {seq.activeLeads} active leads
                        {seq.lastTriggered
                          ? ` · Last triggered ${new Date(seq.lastTriggered).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : ' · No sends logged yet'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditingSeq(seq)}
                      className="text-[12px] border-brand-border">
                      Edit sequence
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === Activity Logs === */}
        {activeTab === 'logs' && (
          loadingLogs ? <SkeletonTable /> : (
            <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-brand-surface">
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Lead</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Sequence</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Step</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Channel</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, i) => {
                    const sc = getStatusColors(log.status);
                    return (
                      <TableRow key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'}>
                        <TableCell className="text-[14px] font-semibold text-brand-ink">{log.leadName}</TableCell>
                        <TableCell className="text-[13px] text-brand-text">{log.sequenceName}</TableCell>
                        <TableCell className="text-[13px] text-brand-text">Step {log.step}</TableCell>
                        <TableCell>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-text">{log.channel}</span>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                            {log.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-[12px] text-brand-muted">
                          {new Date(log.sentAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )
        )}

        {/* === Re-engagement Rules === */}
        {activeTab === 'reengagement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-[17px] font-semibold text-brand-ink">Re-engagement Rules</h2>
                <p className="text-[12px] text-brand-muted mt-0.5">Automated triggers that fire when leads go cold, miss calls, or stop responding</p>
              </div>
              <Button className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px] gap-1.5">
                <Plus className="w-4 h-4" /> New Rule
              </Button>
            </div>

            {loadingRules ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : rules.map(rule => (
              <div key={rule.id} className={`bg-white rounded-[10px] border p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all ${rule.enabled ? 'border-brand-border' : 'border-brand-border opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Zap className={`w-4 h-4 ${rule.enabled ? 'text-amber-500' : 'text-brand-muted'}`} />
                      <h3 className="text-[15px] font-semibold text-brand-ink">{rule.name}</h3>
                      {!rule.enabled && <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                    </div>
                    <p className="text-[12px] text-brand-muted mb-3 ml-6.5">
                      <span className="font-medium text-brand-text">When:</span> {rule.triggerLabel}
                    </p>

                    {/* Actions chain */}
                    <div className="flex items-center gap-1.5 ml-6.5 flex-wrap">
                      {rule.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-surface rounded-md border border-brand-border">
                            {ACTION_ICONS[action.type]}
                            <span className="text-[11px] text-brand-text">{action.label}</span>
                          </div>
                          {i < rule.actions.length - 1 && (
                            <div className="flex items-center gap-0.5 text-brand-muted">
                              <ArrowRight className="w-3 h-3" />
                              {action.delay ? (
                                <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                  {action.delay}{action.delayUnit?.[0]}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 ml-6.5 text-[11px] text-brand-muted">
                      <span>Triggered <strong className="text-brand-ink">{rule.totalTriggered}×</strong></span>
                      <span>Success rate <strong className={rule.successRate >= 50 ? 'text-green-700' : rule.successRate >= 25 ? 'text-amber-700' : 'text-red-700'}>{rule.successRate}%</strong></span>
                      {rule.lastTriggered && (
                        <span>Last: {new Date(rule.lastTriggered).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="text-[11px] h-7 text-brand-muted" onClick={() => setViewingRule(rule)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                    <Switch
                      checked={rule.enabled}
                      disabled={updateRuleMutation.isPending}
                      onCheckedChange={() => toggleRule(rule.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === Trigger History === */}
        {activeTab === 'reengagement_logs' && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-[17px] font-semibold text-brand-ink">Trigger History</h2>
              <p className="text-[12px] text-brand-muted mt-0.5">Every automated re-engagement action taken on leads</p>
            </div>

            {loadingReLogs ? (
              <SkeletonTable />
            ) : (
            <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-brand-surface">
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Lead</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Rule</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Actions</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Outcome</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Triggered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reLogs.map((log, i) => {
                    const outcome = OUTCOME_CONFIG[log.outcome];
                    return (
                      <TableRow key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'}>
                        <TableCell>
                          <span className="text-[14px] font-semibold text-brand-ink">{log.leadName}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="text-[12px] text-brand-text">{log.ruleName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {log.actionsExecuted.map((a, j) => (
                              <div key={j} className="flex items-center gap-1 px-2 py-0.5 bg-brand-surface rounded border border-brand-border" title={`${a.label}: ${a.status}`}>
                                {ACTION_ICONS[a.type]}
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${outcome.color}`}>
                            {outcome.icon} {outcome.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-[12px] text-brand-muted">
                          {new Date(log.triggeredAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Sequence Drawer */}
      <Sheet open={!!editingSeq} onOpenChange={v => { if (!v) setEditingSeq(null); }}>
        <SheetContent className="w-[560px] bg-white border-brand-border p-0 overflow-y-auto" side="right">
          {editingSeq && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-brand-border">
                <SheetTitle className="text-[18px] font-semibold text-brand-ink">{editingSeq.name}</SheetTitle>
              </SheetHeader>
              <div className="px-6 py-4 space-y-3">
                {editingSeq.steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-3 p-4 bg-brand-surface rounded-lg border border-brand-border">
                    <GripVertical className="w-4 h-4 text-brand-muted mt-2 cursor-grab" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-brand-ink">Step {step.stepNumber}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-brand-muted uppercase">Delay</label>
                          <div className="flex gap-1">
                            <Input defaultValue={step.delay} className="h-7 text-[12px] border-brand-border w-14" />
                            <Select defaultValue={step.delayUnit}>
                              <SelectTrigger className="h-7 text-[12px] border-brand-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hours">hours</SelectItem>
                                <SelectItem value="days">days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-brand-muted uppercase">Channel</label>
                          <Select defaultValue={step.channel}>
                            <SelectTrigger className="h-7 text-[12px] border-brand-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                              <SelectItem value="Email">Email</SelectItem>
                              <SelectItem value="Voice">Voice</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] text-brand-muted uppercase">Template</label>
                          <Input defaultValue={step.template} className="h-7 text-[12px] border-brand-border" />
                        </div>
                      </div>
                    </div>
                    <button className="p-1 hover:bg-red-50 rounded mt-2">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
                <button className="w-full border-2 border-dashed border-brand-border rounded-lg p-3 text-[13px] text-brand-muted hover:border-brand-crimson hover:text-brand-crimson flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add step
                </button>
              </div>
              <div className="px-6 py-4 border-t border-brand-border flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingSeq(null)} className="border-brand-border">Cancel</Button>
                <Button className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">Save sequence</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* View Rule Detail Drawer */}
      <Sheet open={!!viewingRule} onOpenChange={v => { if (!v) setViewingRule(null); }}>
        <SheetContent className="w-[520px] bg-white border-brand-border p-0 overflow-y-auto" side="right">
          {viewingRule && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-brand-border">
                <SheetTitle className="text-[18px] font-semibold text-brand-ink flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${viewingRule.enabled ? 'text-amber-500' : 'text-brand-muted'}`} />
                  {viewingRule.name}
                </SheetTitle>
              </SheetHeader>
              <div className="px-6 py-5 space-y-5">
                {/* Trigger */}
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-brand-muted mb-1.5">Trigger Condition</h4>
                  <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[13px] text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> {viewingRule.triggerLabel}
                    </p>
                  </div>
                </div>

                {/* Conditions */}
                {(viewingRule.conditions.daysSinceContact || viewingRule.conditions.temperature || viewingRule.conditions.minScore) && (
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase text-brand-muted mb-1.5">Additional Conditions</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingRule.conditions.daysSinceContact && (
                        <Badge variant="outline" className="text-[11px]">Days since contact ≥ {viewingRule.conditions.daysSinceContact}</Badge>
                      )}
                      {viewingRule.conditions.temperature && (
                        <Badge variant="outline" className="text-[11px]">Temperature: {viewingRule.conditions.temperature}</Badge>
                      )}
                      {viewingRule.conditions.minScore && (
                        <Badge variant="outline" className="text-[11px]">Score ≥ {viewingRule.conditions.minScore}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-brand-muted mb-2">Actions (in order)</h4>
                  <div className="space-y-2">
                    {viewingRule.actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-brand-surface rounded-lg border border-brand-border">
                        <span className="w-5 h-5 rounded-full bg-brand-crimson text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        {ACTION_ICONS[action.type]}
                        <div className="flex-1">
                          <p className="text-[13px] text-brand-ink">{action.label}</p>
                          {action.delay ? (
                            <p className="text-[11px] text-brand-muted">After {action.delay} {action.delayUnit}</p>
                          ) : (
                            <p className="text-[11px] text-brand-muted">Immediately</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-brand-muted mb-2">Performance</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-brand-surface rounded-lg text-center">
                      <p className="text-[20px] font-bold text-brand-ink">{viewingRule.totalTriggered}</p>
                      <p className="text-[10px] text-brand-muted">Times Triggered</p>
                    </div>
                    <div className="p-3 bg-brand-surface rounded-lg text-center">
                      <p className={`text-[20px] font-bold ${viewingRule.successRate >= 50 ? 'text-green-700' : viewingRule.successRate >= 25 ? 'text-amber-700' : 'text-red-700'}`}>
                        {viewingRule.successRate}%
                      </p>
                      <p className="text-[10px] text-brand-muted">Success Rate</p>
                    </div>
                    <div className="p-3 bg-brand-surface rounded-lg text-center">
                      <p className="text-[20px] font-bold text-brand-ink">
                        {Math.round(viewingRule.totalTriggered * viewingRule.successRate / 100)}
                      </p>
                      <p className="text-[10px] text-brand-muted">Leads Saved</p>
                    </div>
                  </div>
                </div>

                {/* Recent triggers for this rule */}
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-brand-muted mb-2">Recent Triggers</h4>
                  <div className="space-y-2">
                    {reLogs.filter(l => l.ruleId === viewingRule.id).slice(0, 5).map(log => {
                      const outcome = OUTCOME_CONFIG[log.outcome];
                      return (
                        <div key={log.id} className="flex items-center justify-between p-2.5 bg-brand-surface rounded-lg border border-brand-border">
                          <div>
                            <p className="text-[13px] font-medium text-brand-ink">{log.leadName}</p>
                            <p className="text-[11px] text-brand-muted">
                              {new Date(log.triggeredAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${outcome.color}`}>
                            {outcome.icon} {outcome.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
