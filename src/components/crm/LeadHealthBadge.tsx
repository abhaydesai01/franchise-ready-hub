import type { LeadTemperature, SLAState } from '@/types/sales';
import { Flame, Sun, Snowflake, Skull } from 'lucide-react';

const tempConfig: Record<LeadTemperature, { icon: typeof Flame; label: string; color: string; bg: string; ring: string }> = {
  hot: { icon: Flame, label: 'Hot', color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200' },
  warm: { icon: Sun, label: 'Warm', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  cold: { icon: Snowflake, label: 'Cold', color: 'text-blue-500', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  dead: { icon: Skull, label: 'Dead', color: 'text-gray-500', bg: 'bg-gray-100', ring: 'ring-gray-300' },
};

interface LeadHealthBadgeProps {
  temperature: LeadTemperature;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function LeadHealthBadge({ temperature, size = 'sm', showLabel = true }: LeadHealthBadgeProps) {
  const config = tempConfig[temperature];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${config.bg} ${config.color} ${config.ring}`}>
      <Icon className={iconSize} />
      {showLabel && config.label}
    </span>
  );
}

// SLA Badge
const slaConfig: Record<SLAState, { label: string; color: string; bg: string; emoji: string }> = {
  on_track: { label: 'On Track', color: 'text-green-700', bg: 'bg-green-50', emoji: '✅' },
  at_risk: { label: 'At Risk', color: 'text-amber-700', bg: 'bg-amber-50', emoji: '⚠️' },
  breached: { label: 'Breached', color: 'text-red-700', bg: 'bg-red-50', emoji: '🚨' },
};

interface SLABadgeProps {
  state: SLAState;
  compact?: boolean;
}

export function SLABadge({ state, compact = false }: SLABadgeProps) {
  const config = slaConfig[state];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
      <span>{config.emoji}</span>
      {!compact && config.label}
    </span>
  );
}

// Risk indicator bar
interface RiskIndicatorProps {
  riskScore: number;
  compact?: boolean;
}

export function RiskIndicator({ riskScore, compact = false }: RiskIndicatorProps) {
  const color = riskScore >= 70 ? '#C8102E' : riskScore >= 40 ? '#D4882A' : '#1B8A4A';
  const label = riskScore >= 70 ? 'High Risk' : riskScore >= 40 ? 'Medium' : 'Low Risk';

  if (compact) {
    return (
      <div className="w-12 h-1.5 bg-brand-surface rounded-full overflow-hidden" title={`Risk: ${riskScore}%`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${riskScore}%`, backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-brand-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${riskScore}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
    </div>
  );
}
