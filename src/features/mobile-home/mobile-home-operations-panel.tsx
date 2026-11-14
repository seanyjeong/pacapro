import { CalendarDays, ListChecks, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeOperationsPanelProps {
  dateLabel: string;
  items: MobileHomeMenuItem[];
  roleLabel: string;
  weekdayLabel: string;
}

function MobileHomeMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-muted px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted-foreground">{label}</span>
        <span className="block truncate text-[15px] font-bold text-foreground">{value}</span>
      </span>
    </div>
  );
}

export function MobileHomeOperationsPanel({ dateLabel, items, roleLabel, weekdayLabel }: MobileHomeOperationsPanelProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <section data-testid="mobile-home-operations-panel" className="rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-foreground">오늘 작업</h2>
          <p className="truncate text-[13px] text-muted-foreground">{dateLabel} {weekdayLabel}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CalendarDays className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MobileHomeMetric icon={ShieldCheck} label="권한" value={roleLabel} />
        <MobileHomeMetric icon={ListChecks} label="가능 업무" value={`${visibleItems.length}개 업무`} />
      </div>
    </section>
  );
}
