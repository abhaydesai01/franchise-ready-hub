import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreateLead } from '@/hooks/useLeads';
import { useTeam } from '@/hooks/useSettings';
import { usePipelineStages } from '@/hooks/usePipeline';
import { toast } from 'sonner';
import type { Source, Track } from '@/types';

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLeadModal({ open, onOpenChange }: AddLeadModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<Source>('Meta Ad');
  const [track, setTrack] = useState<Track>('Not Ready');
  const [pipelineStageId, setPipelineStageId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  const createLead = useCreateLead();
  const { data: teamMembers } = useTeam();
  const { data: allStages = [] } = usePipelineStages();

  const stagesForTrack = useMemo(
    () => allStages.filter((s) => s.track === track && s.isActive).sort((a, b) => a.order - b.order),
    [allStages, track],
  );

  useEffect(() => {
    if (!stagesForTrack.length) {
      setPipelineStageId('');
      return;
    }
    const stillValid = stagesForTrack.some((s) => s.id === pipelineStageId);
    if (!stillValid) {
      setPipelineStageId(stagesForTrack[0].id);
    }
  }, [stagesForTrack, pipelineStageId]);

  const handleSubmit = async () => {
    if (!name || !phone) {
      toast.error('Name and phone are required');
      return;
    }
    if (!pipelineStageId) {
      toast.error('Please select track/stage');
      return;
    }
    try {
      await createLead.mutateAsync({ name, phone, email, source, assignedTo, notes, pipelineStageId });
      toast.success('Lead added successfully');
      onOpenChange(false);
      setName('');
      setPhone('+91');
      setEmail('');
      setSource('Meta Ad');
      setTrack('Not Ready');
      setPipelineStageId('');
      setAssignedTo('');
      setNotes('');
    } catch {
      toast.error('Failed to add lead');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white border-brand-border">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-brand-ink">Add New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Full Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Phone *</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email"
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger className="mt-1 border-brand-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meta Ad">Meta Ad</SelectItem>
                <SelectItem value="WhatsApp Inbound">WhatsApp Inbound</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
                <SelectItem value="Direct">Direct</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Track *</Label>
            <Select value={track} onValueChange={(v) => setTrack(v as Track)}>
              <SelectTrigger className="mt-1 border-brand-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Ready">Not Ready</SelectItem>
                <SelectItem value="Franchise Ready">Franchise Ready</SelectItem>
                <SelectItem value="Recruitment Only">Recruitment Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Initial Stage *</Label>
            <Select value={pipelineStageId} onValueChange={setPipelineStageId} disabled={!stagesForTrack.length}>
              <SelectTrigger className="mt-1 border-brand-border">
                <SelectValue placeholder={stagesForTrack.length ? 'Select stage' : 'No stages available'} />
              </SelectTrigger>
              <SelectContent>
                {stagesForTrack.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Assigned To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="mt-1 border-brand-border">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers?.map(m => (
                  <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px] font-medium text-brand-ink">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."
              className="mt-1 border-brand-border focus:border-brand-crimson focus:ring-brand-crimson/10" rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}
            className="border-brand-border text-brand-text hover:border-brand-crimson hover:text-brand-crimson">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createLead.isPending}
            className="bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg px-5 font-medium">
            {createLead.isPending ? 'Adding...' : 'Add Lead →'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
