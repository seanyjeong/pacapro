import { cn } from '@/lib/utils/cn';

interface EnrolledStatCardProps {
  label: string;
  tone?: 'default' | 'pending' | 'confirmed' | 'completed';
  value: number;
  active: boolean;
  onClick: () => void;
}

const toneClass = {
  default: 'text-foreground',
  pending: 'text-warning',
  confirmed: 'text-primary',
  completed: 'text-success',
} as const;

/** 상태별 상담 수. 누르면 그 상태로 거른다. */
export function EnrolledStatCard({ label, tone = 'default', value, active, onClick }: EnrolledStatCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label} 보기`}
      onClick={onClick}
      className={cn(
        'min-w-0 rounded-2xl bg-card p-5 text-left transition-colors hover:bg-card/70 active:scale-[0.99]',
        active && 'ring-2 ring-primary'
      )}
    >
      <span className="block text-sm font-semibold text-secondary-foreground">{label}</span>
      <span className={cn('mt-1 block text-[26px] font-extrabold leading-tight tracking-tight tabular-nums', toneClass[tone])}>
        {value}
        <span className="ml-0.5 text-sm font-bold text-muted-foreground">건</span>
      </span>
    </button>
  );
}
