import { getTrackColors } from '@/lib/utils';

interface TrackPillProps {
  track: string;
}

export function TrackPill({ track }: TrackPillProps) {
  const colors = getTrackColors(track);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
    >
      {track}
    </span>
  );
}
