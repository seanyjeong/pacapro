import { ListChecks, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeOperationsPanelProps {
  items: MobileHomeMenuItem[];
  roleLabel: string;
}

function MobileHomeMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-1">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted-foreground">{label}</span>
        <span className="block truncate text-[15px] font-bold text-foreground">{value}</span>
      </span>
    </div>
  );
}

export function MobileHomeOperationsPanel({ items, roleLabel }: MobileHomeOperationsPanelProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <section
      data-testid="mobile-home-operations-panel"
      aria-label="오늘 작업"
      className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-4"
    >
      <MobileHomeMetric icon={ShieldCheck} label="권한" value={roleLabel} />
      <MobileHomeMetric icon={ListChecks} label="가능 업무" value={`${visibleItems.length}개`} />
    </section>
  );
}
