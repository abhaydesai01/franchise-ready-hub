import { useState } from 'react';
import { useProposals, useGenerateProposal } from '@/hooks/useProposals';
import { useLeads } from '@/hooks/useLeads';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { TrackPill } from '@/components/crm/TrackPill';
import { getStatusColors } from '@/lib/utils';
import { toast } from 'sonner';

const statusTabs = ['All', 'Draft', 'Sent', 'Opened', 'Signed', 'Rejected'];

export default function Proposals() {
  const [statusFilter, setStatusFilter] = useState('All');
  const { data: proposals = [], isLoading } = useProposals({ status: statusFilter });
  const { data: leadsData } = useLeads();
  const generateProposal = useGenerateProposal();
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [program, setProgram] = useState('Franchise Ready');
  const [callNotes, setCallNotes] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');

  const handleGenerate = async () => {
    setStep(3);
    try {
      const result = await generateProposal.mutateAsync({ leadId: selectedLeadId, program, callNotes });
      setGeneratedContent(result.content);
      toast.success('Proposal generated');
    } catch {
      toast.error('Failed to generate proposal');
      setStep(2);
    }
  };

  const resetModal = () => {
    setModalOpen(false);
    setStep(1);
    setSelectedLeadId('');
    setProgram('Franchise Ready');
    setCallNotes('');
    setGeneratedContent('');
  };

  if (isLoading) return <SkeletonTable rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-brand-surface border border-brand-border">
            {statusTabs.map(tab => (
              <TabsTrigger key={tab} value={tab} className="text-[12px] data-[state=active]:bg-white data-[state=active]:text-brand-crimson">
                {tab} ({tab === 'All' ? proposals.length : proposals.filter(p => p.status === tab).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button onClick={() => setModalOpen(true)} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px] rounded-lg px-4 font-medium">
          Generate Proposal
        </Button>
      </div>

      <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-surface">
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Lead</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Track</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Program</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Created</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Sent</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map((p, i) => {
              const sc = getStatusColors(p.status);
              return (
                <TableRow key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'}>
                  <TableCell className="text-[14px] font-semibold text-brand-ink">{p.leadName}</TableCell>
                  <TableCell><TrackPill track={p.track} /></TableCell>
                  <TableCell className="text-[13px] text-brand-text">{p.program}</TableCell>
                  <TableCell className="text-[12px] text-brand-muted">{p.createdAt}</TableCell>
                  <TableCell className="text-[12px] text-brand-muted">{p.sentAt || '—'}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px] text-brand-muted">{p.openedAt ? `Yes — ${p.openedAt}` : 'Not yet'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Generate Proposal Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) resetModal(); }}>
        <DialogContent className="sm:max-w-[700px] bg-white border-brand-border p-0 max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-[18px] font-semibold text-brand-ink">Step 1: Select Lead</h2>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger className="border-brand-border">
                    <SelectValue placeholder="Choose a lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leadsData?.leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} — {l.track} — Score: {l.score}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button disabled={!selectedLeadId} onClick={() => setStep(2)}
                    className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px]">
                    Next →
                  </Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-[18px] font-semibold text-brand-ink">Step 2: Review Context</h2>
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Program</label>
                  <Select value={program} onValueChange={setProgram}>
                    <SelectTrigger className="border-brand-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Franchise Ready">Franchise Ready (3 months)</SelectItem>
                      <SelectItem value="Franchise Launch">Franchise Launch (6 months)</SelectItem>
                      <SelectItem value="Franchise Performance">Franchise Performance (12 months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Call Notes</label>
                  <Textarea value={callNotes} onChange={e => setCallNotes(e.target.value)}
                    placeholder="Enter discovery call notes..."
                    className="border-brand-border min-h-[120px]" />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)} className="border-brand-border">← Back</Button>
                  <Button onClick={handleGenerate} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px]">
                    Generate with AI →
                  </Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-[18px] font-semibold text-brand-ink">Step 3: Review & Edit</h2>
                {generateProposal.isPending ? (
                  <div className="py-12 text-center">
                    <div className="w-48 h-2 bg-brand-surface rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-brand-crimson rounded-full animate-shimmer" style={{ width: '60%', backgroundImage: 'linear-gradient(90deg, #C8102E 25%, #A50D26 50%, #C8102E 75%)', backgroundSize: '200% 100%' }} />
                    </div>
                    <p className="text-[14px] text-brand-muted mt-3">Drafting your proposal...</p>
                  </div>
                ) : (
                  <>
                    <div className="border border-brand-border rounded-lg p-4 min-h-[200px] prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: generatedContent }} />
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setStep(2)} className="border-brand-border">← Regenerate</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" className="border-brand-border text-[12px]">Send via WhatsApp</Button>
                        <Button variant="outline" className="border-brand-border text-[12px]">Send via Email</Button>
                        <Button variant="outline" className="border-brand-border text-[12px]">Download PDF</Button>
                        <Button onClick={resetModal} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px]">Done</Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
