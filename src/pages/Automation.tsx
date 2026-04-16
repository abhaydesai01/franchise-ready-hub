import { useState } from 'react';
import { useSequences, useAutomationLogs } from '@/hooks/useAutomation';
import { TrackPill } from '@/components/crm/TrackPill';
import { SkeletonTable, SkeletonCard } from '@/components/crm/SkeletonCard';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTrackColors, getStatusColors } from '@/lib/utils';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import type { AutomationSequence, AutomationStep } from '@/types';

export default function Automation() {
  const { data: sequences = [], isLoading: loadingSeq } = useSequences();
  const { data: logs = [], isLoading: loadingLogs } = useAutomationLogs();
  const [activeTab, setActiveTab] = useState<'sequences' | 'logs'>('sequences');
  const [editingSeq, setEditingSeq] = useState<AutomationSequence | null>(null);

  return (
    <div className="flex gap-6">
      {/* Left tabs */}
      <div className="w-48 flex-shrink-0 space-y-1">
        <button onClick={() => setActiveTab('sequences')}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${activeTab === 'sequences' ? 'bg-brand-crimson-lt text-brand-crimson' : 'text-brand-muted hover:bg-brand-surface'}`}>
          Sequences
        </button>
        <button onClick={() => setActiveTab('logs')}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${activeTab === 'logs' ? 'bg-brand-crimson-lt text-brand-crimson' : 'text-brand-muted hover:bg-brand-surface'}`}>
          Activity Log
        </button>
      </div>

      {/* Content */}
      <div className="flex-1">
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
                        {seq.steps.length} steps · {seq.activeLeads} active leads · Last triggered {new Date(seq.lastTriggered).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                {editingSeq.steps.map((step, i) => (
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
    </div>
  );
}
