import type { LucideIcon } from 'lucide-react';

interface SalaryStatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'yellow' | 'default';
}

const toneClasses = {
  blue: ['text-sky-700 dark:text-sky-300', 'bg-sky-50 dark:bg-sky-950/45', 'text-sky-600 dark:text-sky-300'],
  green: ['text-success', 'bg-success-soft', 'text-success'],
  yellow: ['text-warning', 'bg-warning-soft', 'text-warning'],
  default: ['text-foreground', 'bg-muted/70', 'text-muted-foreground'],
};

export function SalaryStatCard({ label, value, detail, icon: Icon, tone = 'default' }: SalaryStatCardProps) {
  const [valueClass, iconBgClass, iconClass] = toneClasses[tone];

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-md border border-border/60 p-2 ${iconBgClass}`}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
      </div>
    </section>
  );
}
