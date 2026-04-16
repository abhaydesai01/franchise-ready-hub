import type { CampaignAttribution } from '@/types';
import { Megaphone, Target, Image, IndianRupee } from 'lucide-react';

interface CampaignCardProps {
  campaign: CampaignAttribution;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const platformColors: Record<string, string> = {
    Facebook: 'bg-blue-100 text-blue-700',
    Instagram: 'bg-pink-100 text-pink-700',
    Messenger: 'bg-purple-100 text-purple-700',
    'Audience Network': 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-white rounded-[10px] border border-brand-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-brand-ink">Ad Attribution</h3>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${platformColors[campaign.platform] || 'bg-gray-100'}`}>
          {campaign.platform}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-brand-muted uppercase tracking-wider">Campaign</span>
            <p className="text-[13px] font-medium text-brand-ink truncate">{campaign.campaignName}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Target className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-brand-muted uppercase tracking-wider">Ad Set</span>
            <p className="text-[13px] font-medium text-brand-ink truncate">{campaign.adsetName}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Image className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-brand-muted uppercase tracking-wider">Ad Creative</span>
            <p className="text-[13px] font-medium text-brand-ink truncate">{campaign.adName}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-brand-border">
          <div className="flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-brand-muted" />
            <span className="text-[12px] text-brand-muted">CPL:</span>
            <span className="text-[13px] font-semibold text-brand-ink">₹{campaign.costPerLead || '—'}</span>
          </div>
          <div>
            <span className="text-[12px] text-brand-muted">Objective:</span>
            <span className="text-[12px] font-medium text-brand-ink ml-1">
              {campaign.objective === 'MESSAGES' ? 'Click-to-WhatsApp' : 'Lead Generation'}
            </span>
          </div>
        </div>

        {campaign.formName && (
          <div className="pt-2 border-t border-brand-border">
            <span className="text-[11px] text-brand-muted">Lead Form:</span>
            <span className="text-[12px] font-medium text-brand-ink ml-1">{campaign.formName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
