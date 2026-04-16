import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 max-w-[360px] mx-auto text-center">
      <div className="w-16 h-16 rounded-full bg-brand-crimson-lt flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="16" rx="3" stroke="#C8102E" strokeWidth="2" />
          <path d="M4 12L16 20L28 12" stroke="#C8102E" strokeWidth="2" />
        </svg>
      </div>
      <h3 className="text-[16px] font-semibold text-brand-ink mb-1">{title}</h3>
      <p className="text-[14px] text-brand-muted mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white rounded-lg px-5 py-2.5 text-sm font-medium">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
