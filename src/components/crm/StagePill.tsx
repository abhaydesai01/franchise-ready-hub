import { getStatusColors } from '@/lib/utils';

interface StagePillProps {
  stage: string;
}

export function StagePill({ stage }: StagePillProps) {
  const colors = getStatusColors(stage);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {stage}
    </span>
  );
}
