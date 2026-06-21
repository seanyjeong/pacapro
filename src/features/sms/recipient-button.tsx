import { cn } from '@/lib/utils';

interface RecipientButtonProps {
  label: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}

export function RecipientButton({ label, detail, selected, onClick }: RecipientButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-3 text-left transition-colors',
        selected ? 'border-sky-400 bg-sky-50' : 'border-border bg-background hover:border-muted-foreground/50'
      )}
    >
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}
