import { CalendarDays, ListChecks, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeOperationsPanelProps {
  dateLabel: string;
  items: MobileHomeMenuItem[];
  roleLabel: string;
  weekdayLabel: string;
}

interface MobileHomeMetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function MobileHomeMetric({ icon: Icon, label, value }: MobileHomeMetricProps) {
  return (
    <div className="min-w-0 rounded-lg border border-white/15 bg-white/10 px-3 py-3">
      <div className="flex items-center gap-2 text-white/65">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function MobileHomeOperationsPanel({ dateLabel, items, roleLabel, weekdayLabel }: MobileHomeOperationsPanelProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <section
      data-testid="mobile-home-operations-panel"
      className="overflow-hidden rounded-lg bg-zinc-950 p-4 text-white shadow-sm dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-300">Mobile Desk</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">오늘 작업</h2>
          <p className="mt-1 truncate text-sm text-white/65">
            {dateLabel} {weekdayLabel}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MobileHomeMetric icon={ShieldCheck} label="권한" value={roleLabel} />
        <MobileHomeMetric icon={ListChecks} label="가능 업무" value={`${visibleItems.length}개 업무`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleItems.map((item) => (
          <span key={item.href} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/75">
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
