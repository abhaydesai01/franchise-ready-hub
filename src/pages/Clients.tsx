import { useState } from 'react';
import { useClients } from '@/hooks/useClients';
import { SkeletonTable, SkeletonCard } from '@/components/crm/SkeletonCard';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { getProgramColors, getStatusColors } from '@/lib/utils';
import { Users, UserCheck, Gift, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const metrics = [
    { label: 'Total Clients', value: clients.length, icon: Users, color: '#C8102E', bg: '#FDEAED' },
    { label: 'Active Onboarding', value: clients.filter(c => c.onboardingStatus === 'In Progress').length, icon: UserCheck, color: '#D4882A', bg: '#FFF3E0' },
    { label: 'Referrals Generated', value: clients.reduce((sum, c) => sum + c.referrals.length, 0), icon: Gift, color: '#1B8A4A', bg: '#EDFAF3' },
  ];

  if (isLoading) return <div className="space-y-4"><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: m.bg }}>
                <m.icon className="w-5 h-5" style={{ color: m.color }} />
              </div>
              <div>
                <p className="text-[32px] font-bold text-brand-ink">{m.value}</p>
                <p className="text-[13px] text-brand-muted">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-surface">
              <TableHead className="w-10"></TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Client</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Signed</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Program</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Onboarding</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Referrals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, i) => {
              const pc = getProgramColors(client.program);
              const sc = getStatusColors(client.onboardingStatus);
              const isExpanded = expanded.includes(client.id);
              return (
                <>
                  <TableRow key={client.id} className={`cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'} hover:bg-brand-surface`}
                    onClick={() => toggleExpand(client.id)}>
                    <TableCell>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-brand-muted" /> : <ChevronRight className="w-4 h-4 text-brand-muted" />}
                    </TableCell>
                    <TableCell className="text-[14px] font-semibold text-brand-ink">{client.name}</TableCell>
                    <TableCell className="text-[12px] text-brand-muted">{client.signedDate}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: pc.bg, color: pc.text }}>
                        {client.program}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {client.onboardingStatus}
                        </span>
                        {client.onboardingStatus === 'In Progress' && (
                          <div className="w-20 h-1.5 bg-brand-surface rounded-full overflow-hidden">
                            <div className="h-full bg-brand-crimson rounded-full" style={{ width: `${client.onboardingProgress}%` }} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-brand-text">{client.referrals.length}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${client.id}-exp`}>
                      <TableCell colSpan={6} className="bg-brand-surface/50 px-8 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-brand-muted">Referral Code:</span>
                            <code className="text-[12px] font-mono bg-white px-2 py-0.5 rounded border border-brand-border">{client.referralCode}</code>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(client.referralCode); toast.success('Copied!'); }}
                              className="p-1 hover:bg-white rounded">
                              <Copy className="w-3.5 h-3.5 text-brand-muted" />
                            </button>
                          </div>
                          {client.referrals.length > 0 ? (
                            <div className="bg-white rounded-lg border border-brand-border overflow-hidden">
                              <table className="w-full text-[12px]">
                                <thead><tr className="border-b border-brand-border">
                                  <th className="text-left px-3 py-2 text-brand-muted font-medium">Name</th>
                                  <th className="text-left px-3 py-2 text-brand-muted font-medium">Stage</th>
                                  <th className="text-left px-3 py-2 text-brand-muted font-medium">Added</th>
                                </tr></thead>
                                <tbody>
                                  {client.referrals.map((ref, ri) => (
                                    <tr key={ri} className="border-b border-brand-border last:border-0">
                                      <td className="px-3 py-2 text-brand-ink font-medium">{ref.name}</td>
                                      <td className="px-3 py-2 text-brand-text">{ref.stage}</td>
                                      <td className="px-3 py-2 text-brand-muted">{ref.addedDate}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-[12px] text-brand-muted">No referrals yet</p>
                          )}
                          <Button variant="outline" size="sm" className="text-[11px] border-brand-border gap-1.5">
                            Request referral via WhatsApp
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
