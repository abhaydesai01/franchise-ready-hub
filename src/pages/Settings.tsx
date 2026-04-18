import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  useSettings,
  useTeam,
  useInviteTeamMember,
  useRemoveTeamMember,
  useUpdateSettings,
  useUpdateIntegrationSetting,
  useTestIntegrationSetting,
  useTestCalendlyWebhook,
  useCalendarIntegrationStatus,
  usePatchAvailability,
  useCalendarUpcoming,
  useCalendarTestSlots,
  useDisconnectGoogleCalendar,
  useDisconnectOutlookCalendar,
} from '@/hooks/useSettings';
import { getApiBase, DEFAULT_AVAILABILITY } from '@/lib/api';
import { getAccessToken } from '@/hooks/useAuth';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MessageCircle, Mail, Zap, Globe, Calendar, Eye, EyeOff, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  WATemplate,
  EmailTemplate,
  AvailabilitySettings,
  WorkingHoursConfig,
} from '@/types';

const integrationIcons: Record<string, React.ElementType> = {
  MessageCircle, Calendar, Mail, Zap, Globe
};

const settingsTabs = [
  'Pipeline',
  'WA Templates',
  'Email Templates',
  'Team',
  'Calendar',
  'Integrations',
] as const;

const WEEKDAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const WEEKDAY_LABEL: Record<(typeof WEEKDAY_ORDER)[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

function readTabFromUrl(): string {
  if (typeof window === 'undefined') return 'Pipeline';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && (settingsTabs as readonly string[]).includes(tab) ? tab : 'Pipeline';
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(readTabFromUrl);
  const { data: settings, isLoading } = useSettings();
  const { data: team = [] } = useTeam();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateSettings = useUpdateSettings();
  const updateIntegration = useUpdateIntegrationSetting();
  const testIntegration = useTestIntegrationSetting();
  const testCalendly = useTestCalendlyWebhook();
  const patchAvailabilityMut = usePatchAvailability();
  const {
    data: calStatus,
    refetch: refetchCalStatus,
    isPending: calIntegrationPending,
  } = useCalendarIntegrationStatus({ enabled: activeTab === 'Calendar' });
  const upcomingCalls = useCalendarUpcoming(activeTab === 'Calendar');
  const testSlotsMut = useCalendarTestSlots();
  const disconnectGoogle = useDisconnectGoogleCalendar();
  const disconnectOutlook = useDisconnectOutlookCalendar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Consultant');
  const [editingTemplate, setEditingTemplate] = useState<WATemplate | EmailTemplate | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [thresholds, setThresholds] = useState(settings?.thresholds);
  const [alertRules, setAlertRules] = useState(settings?.alertRules);
  const [integrationApiKeys, setIntegrationApiKeys] = useState<Record<string, string>>({});
  const [templateDraft, setTemplateDraft] = useState<WATemplate | EmailTemplate | null>(null);
  const [calendlyLink, setCalendlyLink] = useState('');
  const [calendlySigningKey, setCalendlySigningKey] = useState('');
  const [avDraft, setAvDraft] = useState<AvailabilitySettings | null>(null);
  const [testSlotPreview, setTestSlotPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setThresholds(settings.thresholds);
    setAlertRules(settings.alertRules);
    setIntegrationApiKeys(
      settings.integrations.reduce<Record<string, string>>((acc, integration) => {
        acc[integration.id] = integration.apiKey;
        return acc;
      }, {}),
    );
    setCalendlyLink(settings.calendlyLink ?? '');
    setCalendlySigningKey(settings.calendlyWebhookSigningKey ?? '');
    setAvDraft(
      JSON.parse(
        JSON.stringify(
          settings.availabilitySettings ?? DEFAULT_AVAILABILITY,
        ),
      ) as AvailabilitySettings,
    );
  }, [settings]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (settingsTabs as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const g = searchParams.get('google');
    const o = searchParams.get('outlook');
    if (g === 'connected') {
      toast.success('Google Calendar connected');
      void refetchCalStatus();
      const next = new URLSearchParams(searchParams);
      next.delete('google');
      setSearchParams(next, { replace: true });
      return;
    }
    if (o === 'connected') {
      toast.success('Outlook Calendar connected');
      void refetchCalStatus();
      const next = new URLSearchParams(searchParams);
      next.delete('outlook');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, refetchCalStatus, setSearchParams]);

  const goToSettingsTab = (tab: string) => {
    setActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  if (isLoading || !settings) return <SkeletonTable />;

  const handleInvite = async () => {
    if (!inviteEmail) return;
    await inviteMember.mutateAsync({ email: inviteEmail, role: inviteRole });
    toast.success('Invite sent');
    setInviteOpen(false);
    setInviteEmail('');
  };

  const savePipelineConfig = async () => {
    if (!thresholds || !alertRules) return;
    await updateSettings.mutateAsync({ thresholds, alertRules });
    toast.success('Pipeline and alert rules saved');
  };

  const openTemplateEditor = (template: WATemplate | EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateDraft({ ...template });
  };

  const saveTemplate = async () => {
    if (!templateDraft) return;
    const isEmailTemplate = 'subject' in templateDraft;
    const nextPayload = isEmailTemplate
      ? {
          emailTemplates: settings.emailTemplates.map((template) =>
            template.id === templateDraft.id ? (templateDraft as EmailTemplate) : template,
          ),
        }
      : {
          waTemplates: settings.waTemplates.map((template) =>
            template.id === templateDraft.id ? (templateDraft as WATemplate) : template,
          ),
        };
    await updateSettings.mutateAsync(nextPayload);
    setEditingTemplate(null);
    setTemplateDraft(null);
    toast.success('Template saved');
  };

  const saveIntegration = async (id: string) => {
    await updateIntegration.mutateAsync({
      id,
      data: { apiKey: integrationApiKeys[id] ?? '' },
    });
    toast.success('Integration key saved');
  };

  const runIntegrationTest = async (id: string) => {
    const result = await testIntegration.mutateAsync(id);
    toast.success(
      result.connected
        ? 'Connection test passed'
        : 'Connection test failed: missing API key',
    );
  };

  const redirectCalendarConnect = (which: 'google' | 'outlook') => {
    const tok = getAccessToken();
    if (!tok) {
      toast.error('Please sign in again.');
      return;
    }
    window.location.href = `${getApiBase()}/calendar/${which}/connect?access_token=${encodeURIComponent(tok)}`;
  };

  const saveAvailability = async () => {
    if (!avDraft) return;
    await patchAvailabilityMut.mutateAsync({
      slotDurationMinutes: avDraft.slotDurationMinutes,
      bufferBetweenSlots: avDraft.bufferBetweenSlots,
      workingHours: avDraft.workingHours,
      timezone: avDraft.timezone,
      advanceBookingDays: avDraft.advanceBookingDays,
      slotsToOfferInBot: avDraft.slotsToOfferInBot,
      meetingTitle: avDraft.meetingTitle,
      ghlBookingLink: avDraft.ghlBookingLink,
      primaryConsultantUserId: avDraft.primaryConsultantUserId?.trim() || undefined,
    });
    toast.success('Availability settings saved');
  };

  const runTestSlots = async () => {
    setTestSlotPreview(null);
    try {
      const slots = await testSlotsMut.mutateAsync();
      setTestSlotPreview(
        slots.map((s) => `${s.index}. ${s.label} (${s.labelShort})`).join('\n'),
      );
      toast.success('Loaded next available slots');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load slots');
    }
  };

  const updateWorkingDay = (
    day: (typeof WEEKDAY_ORDER)[number],
    patch: Partial<WorkingHoursConfig['monday']>,
  ) => {
    setAvDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workingHours: {
          ...prev.workingHours,
          [day]: { ...prev.workingHours[day], ...patch },
        },
      };
    });
  };

  return (
    <div className="flex gap-6">
      {/* Left tabs */}
      <div className="w-48 flex-shrink-0 flex flex-col min-h-0 max-h-[calc(100vh-7rem)]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted px-1 mb-2">
          Settings
        </p>
        <nav className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
          {settingsTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => goToSettingsTab(tab)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${activeTab === tab ? 'bg-brand-crimson-lt text-brand-crimson' : 'text-brand-muted hover:bg-brand-surface'}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === 'Pipeline' && (
          <div className="bg-white rounded-[10px] border border-brand-border p-6 space-y-6">
            <h3 className="text-[15px] font-semibold text-brand-ink">Score Routing Thresholds</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] text-brand-text">Below this → Not Ready</span>
                  <span className="text-[13px] font-semibold text-brand-ink">{thresholds?.notReadyBelow}</span>
                </div>
                <Slider value={[thresholds?.notReadyBelow ?? 40]} max={100} step={1}
                  onValueChange={(v) => setThresholds((prev) => ({ ...(prev ?? settings.thresholds), notReadyBelow: v[0] }))}
                  className="[&_[role=slider]]:bg-brand-crimson" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] text-brand-text">Above this → Franchise Ready</span>
                  <span className="text-[13px] font-semibold text-brand-ink">{thresholds?.franchiseReadyMin}</span>
                </div>
                <Slider value={[thresholds?.franchiseReadyMin ?? 40]} max={100} step={1}
                  onValueChange={(v) => setThresholds((prev) => ({ ...(prev ?? settings.thresholds), franchiseReadyMin: v[0] }))}
                  className="[&_[role=slider]]:bg-brand-crimson" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-brand-border">
                <div>
                  <label className="text-[12px] text-brand-muted">Cold lead warning days</label>
                  <Input
                    type="number"
                    value={alertRules?.coldLeadDaysWarning ?? 5}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), coldLeadDaysWarning: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-brand-muted">Cold lead critical days</label>
                  <Input
                    type="number"
                    value={alertRules?.coldLeadDaysCritical ?? 8}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), coldLeadDaysCritical: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-brand-muted">Stuck stage warning days</label>
                  <Input
                    type="number"
                    value={alertRules?.stuckStageDaysWarning ?? 7}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), stuckStageDaysWarning: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-brand-muted">Stuck stage critical days</label>
                  <Input
                    type="number"
                    value={alertRules?.stuckStageDaysCritical ?? 12}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), stuckStageDaysCritical: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-brand-muted">Proposal unopened info days</label>
                  <Input
                    type="number"
                    value={alertRules?.proposalNotOpenedDaysInfo ?? 2}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), proposalNotOpenedDaysInfo: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-brand-muted">Proposal unopened warning days</label>
                  <Input
                    type="number"
                    value={alertRules?.proposalNotOpenedDaysWarning ?? 5}
                    onChange={(e) => setAlertRules((prev) => ({ ...(prev ?? settings.alertRules), proposalNotOpenedDaysWarning: Number(e.target.value) }))}
                    className="mt-1 border-brand-border h-8 text-[12px]"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={savePipelineConfig}
                  disabled={updateSettings.isPending}
                  className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px]"
                >
                  Save Rules
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'WA Templates' && (
          <div className="space-y-3">
            {settings.waTemplates.map(t => (
              <div key={t.id} className="bg-white rounded-[10px] border border-brand-border p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-brand-ink">{t.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">WhatsApp</span>
                  </div>
                  <p className="text-[12px] text-brand-muted mt-1 truncate max-w-[500px]">{t.body}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openTemplateEditor(t)} className="text-[12px] border-brand-border">Edit</Button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Email Templates' && (
          <div className="space-y-3">
            {settings.emailTemplates.map(t => (
              <div key={t.id} className="bg-white rounded-[10px] border border-brand-border p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-brand-ink">{t.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Email</span>
                  </div>
                  <p className="text-[12px] text-brand-muted mt-1">Subject: {t.subject}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openTemplateEditor(t)} className="text-[12px] border-brand-border">Edit</Button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Team' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(true)} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px]">
                Invite team member
              </Button>
            </div>
            <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-brand-surface">
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Role</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Added</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="text-[14px] font-semibold text-brand-ink">{member.name}</TableCell>
                      <TableCell className="text-[13px] text-brand-text">{member.email}</TableCell>
                      <TableCell>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-text">{member.role}</span>
                      </TableCell>
                      <TableCell className="text-[12px] text-brand-muted">{member.addedDate}</TableCell>
                      <TableCell>
                        <button onClick={() => { removeMember.mutate(member.id); toast.success('Removed'); }}
                          className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {activeTab === 'Integrations' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-brand-crimson/25 bg-brand-crimson-lt/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-brand-ink">
                  Google Calendar, Outlook &amp; CRM booking
                </p>
                <p className="text-[12px] text-brand-muted mt-1">
                  Connect calendars, set working hours, and test slots — this is separate from API keys below.
                </p>
              </div>
              <Button
                type="button"
                className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px] shrink-0"
                onClick={() => goToSettingsTab('Calendar')}
              >
                Open Calendar tab
              </Button>
            </div>

            <div className="bg-white rounded-[10px] border border-brand-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-surface flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-brand-ink" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-brand-ink">Calendly</h3>
                  <p className="text-[12px] text-brand-muted mt-0.5">
                    Booking link and webhook signing key (from Calendly → Integrations → Webhooks).
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-brand-muted">Event / booking link (shareable URL)</label>
                <Input
                  value={calendlyLink}
                  onChange={(e) => setCalendlyLink(e.target.value)}
                  placeholder="https://calendly.com/your-org/discovery"
                  className="mt-1 border-brand-border h-9 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[12px] text-brand-muted">Webhook signing key</label>
                <Input
                  type="password"
                  value={calendlySigningKey}
                  onChange={(e) => setCalendlySigningKey(e.target.value)}
                  placeholder="Paste signing secret from Calendly"
                  className="mt-1 border-brand-border h-9 text-[13px] font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[13px]"
                  onClick={async () => {
                    await updateSettings.mutateAsync({
                      calendlyLink,
                      calendlyWebhookSigningKey: calendlySigningKey,
                    });
                    toast.success('Calendly settings saved');
                  }}
                >
                  Save Calendly settings
                </Button>
                <Button
                  variant="outline"
                  className="border-brand-border text-[13px]"
                  disabled={testCalendly.isPending}
                  onClick={async () => {
                    const r = await testCalendly.mutateAsync(calendlySigningKey || undefined);
                    toast[r.valid ? 'success' : 'error'](r.message);
                  }}
                >
                  Test connection
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.integrations.map(int => {
              const iconName = int.icon as keyof typeof integrationIcons;
              const Icon = integrationIcons[iconName] || Globe;
              return (
                <div key={int.id} className="bg-white rounded-[10px] border border-brand-border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-surface flex items-center justify-center">
                        <Icon className="w-5 h-5 text-brand-ink" />
                      </div>
                      <span className="text-[14px] font-semibold text-brand-ink">{int.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${int.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={`text-[11px] ${int.connected ? 'text-green-700' : 'text-red-700'}`}>
                        {int.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showApiKeys[int.id] ? 'text' : 'password'}
                      value={integrationApiKeys[int.id] ?? ''}
                      onChange={(e) =>
                        setIntegrationApiKeys((prev) => ({
                          ...prev,
                          [int.id]: e.target.value,
                        }))
                      }
                      placeholder="Enter API key..."
                      className="text-[12px] border-brand-border h-8 font-mono"
                    />
                    <button onClick={() => setShowApiKeys(prev => ({ ...prev, [int.id]: !prev[int.id] }))}
                      className="p-1.5 hover:bg-brand-surface rounded">
                      {showApiKeys[int.id] ? <EyeOff className="w-4 h-4 text-brand-muted" /> : <Eye className="w-4 h-4 text-brand-muted" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px] border-brand-border w-full"
                      onClick={() => saveIntegration(int.id)}
                    >
                      Save key
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px] border-brand-border w-full"
                      onClick={() => runIntegrationTest(int.id)}
                    >
                    Test connection
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {activeTab === 'Calendar' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[16px] font-semibold text-brand-ink">
                Calendar integration
              </h2>
              <p className="text-[12px] text-brand-muted mt-1">
                Connect Google Calendar for live availability and Meet links, and Outlook for
                your diary. Availability rules apply to CRM booking and voice agent slots.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-[10px] border border-brand-border p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-brand-ink">
                    Google Calendar
                  </h3>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      calIntegrationPending
                        ? 'bg-brand-surface text-brand-muted'
                        : calStatus?.google.connected
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {calIntegrationPending
                      ? 'Loading…'
                      : calStatus?.google.connected
                        ? 'Connected'
                        : 'Not connected'}
                  </span>
                </div>
                {calStatus?.google.connected && calStatus.google.email ? (
                  <p className="text-[12px] text-brand-text">
                    <span className="text-brand-muted">Account: </span>
                    {calStatus.google.email}
                  </p>
                ) : null}
                <p className="text-[11px] text-brand-muted">
                  Last sync:{' '}
                  {calStatus?.google.lastSyncAt
                    ? new Date(calStatus.google.lastSyncAt).toLocaleString('en-IN')
                    : '—'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px]"
                    onClick={() => redirectCalendarConnect('google')}
                  >
                    Connect Google Calendar
                  </Button>
                  {calStatus?.google.connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-brand-border text-[12px]"
                      disabled={disconnectGoogle.isPending}
                      onClick={async () => {
                        await disconnectGoogle.mutateAsync();
                        toast.success('Google Calendar disconnected');
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="bg-white rounded-[10px] border border-brand-border p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-brand-ink">
                    Outlook Calendar
                  </h3>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      calIntegrationPending
                        ? 'bg-brand-surface text-brand-muted'
                        : calStatus?.outlook.connected
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {calIntegrationPending
                      ? 'Loading…'
                      : calStatus?.outlook.connected
                        ? 'Connected'
                        : 'Not connected'}
                  </span>
                </div>
                {calStatus?.outlook.connected && calStatus.outlook.email ? (
                  <p className="text-[12px] text-brand-text">
                    <span className="text-brand-muted">Account: </span>
                    {calStatus.outlook.email}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px]"
                    onClick={() => redirectCalendarConnect('outlook')}
                  >
                    Connect Outlook
                  </Button>
                  {calStatus?.outlook.connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-brand-border text-[12px]"
                      disabled={disconnectOutlook.isPending}
                      onClick={async () => {
                        await disconnectOutlook.mutateAsync();
                        toast.success('Outlook disconnected');
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[10px] border border-brand-border p-5 space-y-4">
              <h3 className="text-[14px] font-semibold text-brand-ink">
                Availability settings
              </h3>
              {avDraft ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] text-brand-muted">Primary consultant (Rahul)</label>
                      <Select
                        value={avDraft.primaryConsultantUserId ?? '__none'}
                        onValueChange={(v) =>
                          setAvDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  primaryConsultantUserId: v === '__none' ? undefined : v,
                                }
                              : prev,
                          )
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Not set</SelectItem>
                          {team.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] text-brand-muted">Timezone</label>
                      <Select
                        value={avDraft.timezone}
                        onValueChange={(v) =>
                          setAvDraft((prev) => (prev ? { ...prev, timezone: v } : prev))
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                          <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                          <SelectItem value="Europe/London">Europe/London</SelectItem>
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] text-brand-muted">Slot duration</label>
                      <Select
                        value={String(avDraft.slotDurationMinutes)}
                        onValueChange={(v) =>
                          setAvDraft((prev) =>
                            prev ? { ...prev, slotDurationMinutes: Number(v) } : prev,
                          )
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[15, 30, 45, 60].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] text-brand-muted">Buffer between slots</label>
                      <Select
                        value={String(avDraft.bufferBetweenSlots)}
                        onValueChange={(v) =>
                          setAvDraft((prev) =>
                            prev ? { ...prev, bufferBetweenSlots: Number(v) } : prev,
                          )
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 10, 15, 30].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] text-brand-muted">Advance booking window</label>
                      <Select
                        value={String(avDraft.advanceBookingDays)}
                        onValueChange={(v) =>
                          setAvDraft((prev) =>
                            prev ? { ...prev, advanceBookingDays: Number(v) } : prev,
                          )
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 7, 14].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} days
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] text-brand-muted">Slots to offer (bot / voice)</label>
                      <Select
                        value={String(avDraft.slotsToOfferInBot)}
                        onValueChange={(v) =>
                          setAvDraft((prev) =>
                            prev ? { ...prev, slotsToOfferInBot: Number(v) } : prev,
                          )
                        }
                      >
                        <SelectTrigger className="mt-1 border-brand-border h-9 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} slots
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] text-brand-muted">Meeting title (calendar)</label>
                    <Input
                      value={avDraft.meetingTitle}
                      onChange={(e) =>
                        setAvDraft((prev) =>
                          prev ? { ...prev, meetingTitle: e.target.value } : prev,
                        )
                      }
                      className="mt-1 border-brand-border h-9 text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] text-brand-muted">
                      GHL / fallback booking link
                    </label>
                    <Input
                      value={avDraft.ghlBookingLink}
                      onChange={(e) =>
                        setAvDraft((prev) =>
                          prev ? { ...prev, ghlBookingLink: e.target.value } : prev,
                        )
                      }
                      placeholder="https://..."
                      className="mt-1 border-brand-border h-9 text-[13px]"
                    />
                  </div>

                  <div className="border border-brand-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-brand-surface">
                          <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                            Day
                          </TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                            Working
                          </TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                            Start
                          </TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                            End
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {WEEKDAY_ORDER.map((day) => (
                          <TableRow key={day}>
                            <TableCell className="text-[13px] text-brand-ink">
                              {WEEKDAY_LABEL[day]}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={avDraft.workingHours[day].enabled}
                                onCheckedChange={(on) =>
                                  updateWorkingDay(day, { enabled: on })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="time"
                                className="h-8 text-[12px] border-brand-border w-[110px]"
                                value={avDraft.workingHours[day].start}
                                onChange={(e) =>
                                  updateWorkingDay(day, { start: e.target.value })
                                }
                                disabled={!avDraft.workingHours[day].enabled}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="time"
                                className="h-8 text-[12px] border-brand-border w-[110px]"
                                value={avDraft.workingHours[day].end}
                                onChange={(e) =>
                                  updateWorkingDay(day, { end: e.target.value })
                                }
                                disabled={!avDraft.workingHours[day].enabled}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px]"
                      disabled={patchAvailabilityMut.isPending}
                      onClick={() => void saveAvailability()}
                    >
                      Save availability
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-brand-border text-[12px]"
                      disabled={testSlotsMut.isPending}
                      onClick={() => void runTestSlots()}
                    >
                      Test availability — show next 5 slots
                    </Button>
                  </div>

                  {testSlotPreview ? (
                    <pre className="text-[11px] bg-brand-surface border border-brand-border rounded-lg p-3 whitespace-pre-wrap font-mono text-brand-text">
                      {testSlotPreview}
                    </pre>
                  ) : null}
                </>
              ) : (
                <p className="text-[12px] text-brand-muted">Loading…</p>
              )}
            </div>

            <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-border">
                <h3 className="text-[14px] font-semibold text-brand-ink">
                  Upcoming discovery calls (7 days)
                </h3>
              </div>
              {upcomingCalls.isLoading ? (
                <div className="p-5 text-[12px] text-brand-muted">Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand-surface">
                      <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                        Lead
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                        When
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                        Meet
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">
                        CRM
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(upcomingCalls.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-[12px] text-brand-muted py-6 text-center"
                        >
                          No scheduled calls in the next 7 days.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (upcomingCalls.data ?? []).map((row) => (
                        <TableRow key={row.leadId}>
                          <TableCell className="text-[13px] font-medium text-brand-ink">
                            {row.leadName}
                          </TableCell>
                          <TableCell className="text-[12px] text-brand-text">
                            {row.scheduledAt
                              ? new Date(row.scheduledAt).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {row.meetLink ? (
                              <a
                                href={row.meetLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] text-brand-crimson hover:underline"
                              >
                                Join Meet
                              </a>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={row.profileUrl}
                              className="text-[12px] text-brand-crimson hover:underline"
                            >
                              Open lead
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-brand-border">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-brand-ink">Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address"
              className="border-brand-border focus:border-brand-crimson" />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="border-brand-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Consultant">Consultant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="border-brand-border">Cancel</Button>
            <Button onClick={handleInvite} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">Send Invite</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Edit Drawer */}
      <Sheet open={!!editingTemplate} onOpenChange={v => { if (!v) { setEditingTemplate(null); setTemplateDraft(null); } }}>
        <SheetContent className="w-[480px] bg-white border-brand-border p-0" side="right">
          {editingTemplate && templateDraft && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-brand-border">
                <SheetTitle className="text-[18px] font-semibold text-brand-ink">{templateDraft.name}</SheetTitle>
              </SheetHeader>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Template Name</label>
                  <Input
                    value={templateDraft.name}
                    onChange={(e) =>
                      setTemplateDraft((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                    className="border-brand-border"
                  />
                </div>
                {'subject' in templateDraft && (
                  <div>
                    <label className="text-[13px] font-medium text-brand-ink block mb-1">Subject</label>
                    <Input
                      value={(templateDraft as EmailTemplate).subject}
                      onChange={(e) =>
                        setTemplateDraft((prev) =>
                          prev && 'subject' in prev
                            ? { ...prev, subject: e.target.value }
                            : prev,
                        )
                      }
                      className="border-brand-border"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Body</label>
                  <Textarea
                    value={templateDraft.body}
                    onChange={(e) =>
                      setTemplateDraft((prev) =>
                        prev ? { ...prev, body: e.target.value } : prev,
                      )
                    }
                    className="border-brand-border min-h-[200px] text-[13px]"
                  />
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {['{lead_name}', '{score}', '{consultant_name}'].map(v => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-brand-crimson-lt text-brand-crimson font-mono">{v}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-brand-border flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditingTemplate(null); setTemplateDraft(null); }} className="border-brand-border">Cancel</Button>
                <Button onClick={saveTemplate}
                  className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">Save template</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
