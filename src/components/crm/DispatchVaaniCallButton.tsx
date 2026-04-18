import type { MouseEvent } from 'react';
import { PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTriggerVaaniTestCall } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Props = {
  leadId: string;
  /** "button" = outline with label, "icon" = compact (e.g. table) */
  variant?: 'button' | 'icon';
  className?: string;
  disabled?: boolean;
};

export function DispatchVaaniCallButton({
  leadId,
  variant = 'button',
  className,
  disabled,
}: Props) {
  const mut = useTriggerVaaniTestCall();
  const busy = mut.isPending || disabled;

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    try {
      await mut.mutateAsync({ leadId });
      toast.success('Call dispatch started — see Voice tab for details & sync');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispatch failed');
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7 text-brand-crimson hover:text-brand-crimson-dk', className)}
        onClick={onClick}
        disabled={busy}
        title="Dispatch Optimizer call to this number"
        aria-label="Dispatch Optimizer call"
      >
        <PhoneCall className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn('text-[12px] border-brand-crimson/40 text-brand-crimson gap-1.5', className)}
      onClick={onClick}
      disabled={busy}
    >
      <PhoneCall className="w-3.5 h-3.5" />
      {busy ? 'Dispatching…' : 'Dispatch call'}
    </Button>
  );
}
