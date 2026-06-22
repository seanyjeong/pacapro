import type { LucideIcon } from 'lucide-react';

interface CreditStatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'default' | 'orange' | 'green' | 'blue';
}

const toneClasses = {
  default: 'text-foreground bg-muted text-muted-foreground',
  orange: 'text-orange-700 bg-orange-50 text-orange-600',
  green: 'text-emerald-700 bg-emerald-50 text-emerald-600',
  blue: 'text-blue-700 bg-blue-50 text-blue-600',
};

export function CreditStatCard({ label, value, detail, icon: Icon, tone = 'default' }: CreditStatCardProps) {
  const [valueClass, iconBgClass, iconClass] = toneClasses[tone].split(' ');

  return (
    <section className="rounded-lg border border-border/70 bg-card p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
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
