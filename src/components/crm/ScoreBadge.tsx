import { getScoreTier } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  const tier = getScoreTier(score);
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`}
      style={{ backgroundColor: tier.bgColor, color: tier.textColor }}
    >
      {score}
    </span>
  );
}
