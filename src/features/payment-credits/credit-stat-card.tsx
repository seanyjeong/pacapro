import type { LucideIcon } from 'lucide-react';

interface CreditStatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'default' | 'orange' | 'green' | 'blue';
}

const toneClasses = {
  default: { value: 'text-foreground', iconBg: 'bg-muted', icon: 'text-muted-foreground' },
  orange: { value: 'text-warning', iconBg: 'bg-warning-soft', icon: 'text-warning' },
  green: { value: 'text-success', iconBg: 'bg-success-soft', icon: 'text-success' },
  blue: { value: 'text-primary', iconBg: 'bg-primary-soft', icon: 'text-primary' },
};

export function CreditStatCard({ label, value, detail, icon: Icon, tone = 'default' }: CreditStatCardProps) {
  const toneClass = toneClasses[tone];

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${toneClass.value}`}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-md border border-border/60 p-2 ${toneClass.iconBg} dark:bg-muted/40`}>
          <Icon className={`h-4 w-4 ${toneClass.icon}`} />
        </div>
      </div>
    </section>
  );
}
