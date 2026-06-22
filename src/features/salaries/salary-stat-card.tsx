import type { LucideIcon } from 'lucide-react';

interface SalaryStatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'yellow' | 'default';
}

const toneClasses = {
  blue: ['text-blue-700', 'bg-blue-50', 'text-blue-600'],
  green: ['text-emerald-700', 'bg-emerald-50', 'text-emerald-600'],
  yellow: ['text-amber-700', 'bg-amber-50', 'text-amber-600'],
  default: ['text-foreground', 'bg-muted', 'text-muted-foreground'],
};

export function SalaryStatCard({ label, value, detail, icon: Icon, tone = 'default' }: SalaryStatCardProps) {
  const [valueClass, iconBgClass, iconClass] = toneClasses[tone];

  return (
    <section className="rounded-lg border border-border/70 bg-card p-5 shadow-none">
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
