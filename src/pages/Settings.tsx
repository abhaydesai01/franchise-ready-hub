import { useState } from 'react';
import { useSettings, useTeam, useInviteTeamMember, useRemoveTeamMember, useUpdateSettings } from '@/hooks/useSettings';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MessageCircle, Mail, Zap, Globe, Calendar, Eye, EyeOff, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WATemplate, EmailTemplate } from '@/types';

const integrationIcons: Record<string, React.ElementType> = {
  MessageCircle, Calendar, Mail, Zap, Globe
};

const settingsTabs = ['Pipeline', 'WA Templates', 'Email Templates', 'Team', 'Integrations'];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: team = [] } = useTeam();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateSettings = useUpdateSettings();
  const [activeTab, setActiveTab] = useState('Pipeline');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Consultant');
  const [editingTemplate, setEditingTemplate] = useState<WATemplate | EmailTemplate | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  if (isLoading || !settings) return <SkeletonTable />;

  const handleInvite = async () => {
    if (!inviteEmail) return;
    await inviteMember.mutateAsync({ email: inviteEmail, role: inviteRole });
    toast.success('Invite sent');
    setInviteOpen(false);
    setInviteEmail('');
  };

  return (
    <div className="flex gap-6">
      {/* Left tabs */}
      <div className="w-48 flex-shrink-0 space-y-1">
        {settingsTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${activeTab === tab ? 'bg-brand-crimson-lt text-brand-crimson' : 'text-brand-muted hover:bg-brand-surface'}`}>
            {tab}
          </button>
        ))}
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
                  <span className="text-[13px] font-semibold text-brand-ink">{settings.thresholds.notReadyBelow}</span>
                </div>
                <Slider defaultValue={[settings.thresholds.notReadyBelow]} max={100} step={1}
                  className="[&_[role=slider]]:bg-brand-crimson" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] text-brand-text">Above this → Franchise Ready</span>
                  <span className="text-[13px] font-semibold text-brand-ink">{settings.thresholds.franchiseReadyMin}</span>
                </div>
                <Slider defaultValue={[settings.thresholds.franchiseReadyMin]} max={100} step={1}
                  className="[&_[role=slider]]:bg-brand-crimson" />
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
                <Button variant="outline" size="sm" onClick={() => setEditingTemplate(t)} className="text-[12px] border-brand-border">Edit</Button>
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
                <Button variant="outline" size="sm" onClick={() => setEditingTemplate(t)} className="text-[12px] border-brand-border">Edit</Button>
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
                      defaultValue={int.apiKey}
                      placeholder="Enter API key..."
                      className="text-[12px] border-brand-border h-8 font-mono"
                    />
                    <button onClick={() => setShowApiKeys(prev => ({ ...prev, [int.id]: !prev[int.id] }))}
                      className="p-1.5 hover:bg-brand-surface rounded">
                      {showApiKeys[int.id] ? <EyeOff className="w-4 h-4 text-brand-muted" /> : <Eye className="w-4 h-4 text-brand-muted" />}
                    </button>
                  </div>
                  <Button variant="outline" size="sm" className="text-[11px] border-brand-border w-full">
                    Test connection
                  </Button>
                </div>
              );
            })}
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
      <Sheet open={!!editingTemplate} onOpenChange={v => { if (!v) setEditingTemplate(null); }}>
        <SheetContent className="w-[480px] bg-white border-brand-border p-0" side="right">
          {editingTemplate && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-brand-border">
                <SheetTitle className="text-[18px] font-semibold text-brand-ink">{editingTemplate.name}</SheetTitle>
              </SheetHeader>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Template Name</label>
                  <Input defaultValue={editingTemplate.name} className="border-brand-border" />
                </div>
                {'subject' in editingTemplate && (
                  <div>
                    <label className="text-[13px] font-medium text-brand-ink block mb-1">Subject</label>
                    <Input defaultValue={(editingTemplate as EmailTemplate).subject} className="border-brand-border" />
                  </div>
                )}
                <div>
                  <label className="text-[13px] font-medium text-brand-ink block mb-1">Body</label>
                  <Textarea defaultValue={editingTemplate.body} className="border-brand-border min-h-[200px] text-[13px]" />
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {['{lead_name}', '{score}', '{consultant_name}'].map(v => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-brand-crimson-lt text-brand-crimson font-mono">{v}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-brand-border flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingTemplate(null)} className="border-brand-border">Cancel</Button>
                <Button onClick={() => { setEditingTemplate(null); toast.success('Template saved'); }}
                  className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">Save template</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
