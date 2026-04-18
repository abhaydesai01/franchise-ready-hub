import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  markDiscoveryCallComplete,
  submitPostCallNotes,
  type PostCallNotesPayload,
} from '@/lib/api';
import type { Lead } from '@/types';
import { toast } from 'sonner';

const OUTCOMES: { value: PostCallNotesPayload['outcome']; label: string }[] = [
  { value: 'ready_to_proceed', label: 'Prospect is ready to proceed' },
  { value: 'needs_more_time', label: 'Prospect needs more time or information' },
  { value: 'not_interested', label: 'Prospect is not interested' },
];

const SERVICE_TYPES: {
  value: NonNullable<PostCallNotesPayload['serviceType']>;
  label: string;
}[] = [
  { value: 'full_consulting', label: 'Full franchise consulting' },
  {
    value: 'recruitment_only',
    label: 'Recruitment only — already has franchise tools',
  },
  {
    value: 'needs_development',
    label: 'Needs development before franchising',
  },
];

const DOC_OPTIONS: { value: PostCallNotesPayload['docRequired']; label: string }[] = [
  {
    value: 'proposal',
    label:
      'Generate a Proposal — prospect agreed in principle, we are moving to commercial terms',
  },
  {
    value: 'mom',
    label:
      'Generate an MOM — prospect needs more process, we are documenting what was discussed and next steps',
  },
  { value: 'none', label: 'No document needed right now' },
];

function formatSubmitted(n: Lead['callNotes']) {
  if (!n) return null;
  const o = OUTCOMES.find((x) => x.value === n.outcome)?.label ?? n.outcome;
  const svc = n.serviceType
    ? SERVICE_TYPES.find((x) => x.value === n.serviceType)?.label
    : '—';
  const doc = DOC_OPTIONS.find((x) => x.value === n.docRequired)?.label ?? n.docRequired;
  return { o, svc, doc };
}

export function PostCallSection({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const dc = lead.discoveryCall;
  const submitted = !!lead.callNotes?.submittedAt;

  /** Post-call UI when discovery call is scheduled or completed (not cancelled). */
  const eligible =
    dc && (dc.status === 'scheduled' || dc.status === 'completed');

  const [outcome, setOutcome] = useState<PostCallNotesPayload['outcome']>(
    'ready_to_proceed',
  );
  const [serviceType, setServiceType] = useState<string>('');
  const [engagementScope, setEngagementScope] = useState('');
  const [priceDiscussed, setPriceDiscussed] = useState<string>('');
  const [objections, setObjections] = useState('');
  const [commitments, setCommitments] = useState('');
  const [consultantNotes, setConsultantNotes] = useState('');
  const [docRequired, setDocRequired] =
    useState<PostCallNotesPayload['docRequired']>('proposal');
  const [nextStep, setNextStep] = useState('');

  const markDone = useMutation({
    mutationFn: () => markDiscoveryCallComplete(lead.id),
    onSuccess: (updated) => {
      qc.setQueryData(['lead', lead.id], updated);
      qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      toast.success('Call marked complete — add your notes below.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: (payload: PostCallNotesPayload) =>
      submitPostCallNotes(lead.id, payload),
    onSuccess: ({ lead: updated, docTriggered }) => {
      qc.setQueryData(['lead', lead.id], updated);
      qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      qc.invalidateQueries({ queryKey: ['leadJourney', lead.id] });
      qc.invalidateQueries({ queryKey: ['leadActivity', lead.id] });
      if (docTriggered === 'proposal') {
        toast.success(
          "Proposal generation started — you'll be notified when it's ready for review.",
        );
      } else if (docTriggered === 'mom') {
        toast.success('MOM generation started.');
      } else {
        toast.success('Post-call notes saved.');
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!eligible) {
    return null;
  }

  if (submitted && lead.callNotes) {
    const fmt = formatSubmitted(lead.callNotes);
    return (
      <div className="bg-white rounded-[10px] border border-brand-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-brand-crimson" />
          <h3 className="text-[15px] font-semibold text-brand-ink">Post-call notes</h3>
        </div>
        <p className="text-[12px] text-brand-muted mb-2">
          Submitted {new Date(lead.callNotes.submittedAt!).toLocaleString()}
        </p>
        <dl className="space-y-2 text-[13px]">
          <div>
            <dt className="text-brand-muted">Outcome</dt>
            <dd>{fmt?.o}</dd>
          </div>
          {lead.callNotes.outcome !== 'not_interested' && (
            <div>
              <dt className="text-brand-muted">Service type</dt>
              <dd>{fmt?.svc}</dd>
            </div>
          )}
          <div>
            <dt className="text-brand-muted">Engagement scope</dt>
            <dd className="whitespace-pre-wrap">{lead.callNotes.engagementScope}</dd>
          </div>
          {lead.callNotes.priceDiscussed != null && (
            <div>
              <dt className="text-brand-muted">Price discussed (₹)</dt>
              <dd>{lead.callNotes.priceDiscussed}</dd>
            </div>
          )}
          {lead.callNotes.objections && (
            <div>
              <dt className="text-brand-muted">Objections</dt>
              <dd className="whitespace-pre-wrap">{lead.callNotes.objections}</dd>
            </div>
          )}
          {lead.callNotes.commitments && (
            <div>
              <dt className="text-brand-muted">Commitments</dt>
              <dd className="whitespace-pre-wrap">{lead.callNotes.commitments}</dd>
            </div>
          )}
          <div>
            <dt className="text-brand-muted">Consultant notes</dt>
            <dd className="whitespace-pre-wrap">{lead.callNotes.consultantNotes}</dd>
          </div>
          <div>
            <dt className="text-brand-muted">Document</dt>
            <dd>{fmt?.doc}</dd>
          </div>
          <div>
            <dt className="text-brand-muted">Next step</dt>
            <dd>{lead.callNotes.nextStep}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const showMarkButton = dc.status === 'scheduled';
  const showForm = dc.status === 'completed';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (engagementScope.trim().length < 20) {
      toast.error('Engagement scope must be at least 20 characters.');
      return;
    }
    if (!consultantNotes.trim() || !nextStep.trim()) {
      toast.error('Please complete all required fields.');
      return;
    }
    if (outcome !== 'not_interested' && !serviceType) {
      toast.error('Select a service type.');
      return;
    }

    const payload: PostCallNotesPayload = {
      outcome,
      engagementScope: engagementScope.trim(),
      consultantNotes: consultantNotes.trim(),
      docRequired,
      nextStep: nextStep.trim(),
      ...(outcome !== 'not_interested' && serviceType
        ? { serviceType: serviceType as PostCallNotesPayload['serviceType'] }
        : {}),
      ...(priceDiscussed.trim() !== ''
        ? { priceDiscussed: Number(priceDiscussed.replace(/,/g, '')) }
        : {}),
      ...(objections.trim() ? { objections: objections.trim() } : {}),
      ...(commitments.trim() ? { commitments: commitments.trim() } : {}),
    };

    submit.mutate(payload);
  };

  return (
    <div className="bg-white rounded-[10px] border border-brand-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-brand-crimson" />
        <h3 className="text-[15px] font-semibold text-brand-ink">Post-call</h3>
      </div>

      {showMarkButton && (
        <div className="mb-4">
          <p className="text-[13px] text-brand-muted mb-3">
            After the discovery call, mark it complete and capture your notes here.
          </p>
          <Button
            type="button"
            className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px]"
            disabled={markDone.isPending}
            onClick={() => markDone.mutate()}
          >
            {markDone.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                Updating…
              </>
            ) : (
              'Mark call as done + add notes'
            )}
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[13px] text-brand-ink">Outcome</Label>
            <RadioGroup
              value={outcome}
              onValueChange={(v) => {
                setOutcome(v as PostCallNotesPayload['outcome']);
                if (v === 'not_interested') setServiceType('');
              }}
              className="space-y-2"
            >
              {OUTCOMES.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem value={opt.value} id={`oc-${opt.value}`} className="mt-1" />
                  <Label
                    htmlFor={`oc-${opt.value}`}
                    className="text-[13px] font-normal leading-snug cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {outcome !== 'not_interested' && (
            <div className="space-y-2">
              <Label className="text-[13px]">Service type</Label>
              <Select value={serviceType} onValueChange={setServiceType} required>
                <SelectTrigger className="text-[13px] border-brand-border">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-[13px]">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[13px]">
              Describe what was agreed — what will we do for them, for how long, and what does
              success look like? <span className="text-red-600">*</span>
            </Label>
            <Textarea
              value={engagementScope}
              onChange={(e) => setEngagementScope(e.target.value)}
              className="text-[13px] min-h-[100px] border-brand-border"
              required
              minLength={20}
            />
            <p className="text-[11px] text-brand-muted">Minimum 20 characters.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px]">Approximate price or range discussed (₹) — optional</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={priceDiscussed}
              onChange={(e) => setPriceDiscussed(e.target.value)}
              className="text-[13px] border-brand-border"
              placeholder="e.g. 150000"
            />
            {priceDiscussed.trim() === '' && (
              <Alert className="border-amber-200 bg-amber-50 py-2">
                <AlertDescription className="text-[12px] text-amber-900">
                  Price not recorded — make sure to capture this before sending a proposal.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-brand-muted">
              What concerns or objections did the prospect raise? (optional)
            </Label>
            <Textarea
              value={objections}
              onChange={(e) => setObjections(e.target.value)}
              className="text-[13px] min-h-[72px] border-brand-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-brand-muted">
              What commitments did you make to the prospect? (optional)
            </Label>
            <Textarea
              value={commitments}
              onChange={(e) => setCommitments(e.target.value)}
              className="text-[13px] min-h-[72px] border-brand-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px]">
              Any other context for proposal or MOM — tone, personal details, urgency{' '}
              <span className="text-red-600">*</span>
            </Label>
            <Textarea
              value={consultantNotes}
              onChange={(e) => setConsultantNotes(e.target.value)}
              className="text-[13px] min-h-[88px] border-brand-border"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px]">Document decision</Label>
            <RadioGroup
              value={docRequired}
              onValueChange={(v) =>
                setDocRequired(v as PostCallNotesPayload['docRequired'])
              }
              className="space-y-3"
            >
              {DOC_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem value={opt.value} id={`doc-${opt.value}`} className="mt-1" />
                  <Label
                    htmlFor={`doc-${opt.value}`}
                    className="text-[12px] font-normal leading-snug cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px]">
              What is the specific next action and when? <span className="text-red-600">*</span>
            </Label>
            <Input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="text-[13px] border-brand-border"
              placeholder='e.g. "Send proposal by Friday"'
              required
            />
          </div>

          <Button
            type="submit"
            className="bg-brand-crimson hover:bg-brand-crimson-dk text-white"
            disabled={submit.isPending}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Save post-call notes'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
