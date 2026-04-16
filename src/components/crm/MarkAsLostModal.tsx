import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { LossReason } from '@/types/sales';
import { LOSS_REASON_LABELS } from '@/types/sales';
import { toast } from 'sonner';

interface MarkAsLostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  currentStage: string;
  currentTrack: string;
  onConfirm: (data: { reason: LossReason; competitorName?: string; notes?: string }) => void;
}

export function MarkAsLostModal({ open, onOpenChange, leadName, currentStage, currentTrack, onConfirm }: MarkAsLostModalProps) {
  const [reason, setReason] = useState<LossReason | ''>('');
  const [competitorName, setCompetitorName] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!reason) {
      toast.error('Please select a loss reason');
      return;
    }
    onConfirm({ reason, competitorName: competitorName || undefined, notes: notes || undefined });
    setReason('');
    setCompetitorName('');
    setNotes('');
    onOpenChange(false);
    toast.success(`${leadName} marked as lost`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] text-brand-ink">Mark Lead as Lost</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[13px] text-red-800 font-medium">{leadName}</p>
            <p className="text-[12px] text-red-600">{currentTrack} → {currentStage}</p>
          </div>

          <div>
            <Label className="text-[13px] font-semibold text-brand-ink mb-2 block">Why was this lead lost?</Label>
            <RadioGroup value={reason} onValueChange={v => setReason(v as LossReason)} className="space-y-2">
              {(Object.entries(LOSS_REASON_LABELS) as [LossReason, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="text-[13px] text-brand-text cursor-pointer">{label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === 'chose_competitor' && (
            <div>
              <Label className="text-[13px] font-semibold text-brand-ink">Competitor name</Label>
              <Input value={competitorName} onChange={e => setCompetitorName(e.target.value)}
                placeholder="e.g. FranConnect India" className="mt-1 text-[13px] border-brand-border" />
            </div>
          )}

          <div>
            <Label className="text-[13px] font-semibold text-brand-ink">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What happened? Any learnings?" className="mt-1 text-[13px] border-brand-border min-h-[60px]" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px] border-brand-border">Cancel</Button>
            <Button onClick={handleSubmit} className="text-[13px] bg-red-600 hover:bg-red-700 text-white">Mark as Lost</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
