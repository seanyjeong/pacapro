import { CalendarDays, CircleCheck, Flag, Trophy } from 'lucide-react';

interface SeasonListSummaryProps {
  stats: {
    active: number;
    early: number;
    regular: number;
    total: number;
  };
}

export function SeasonListSummary({ stats }: SeasonListSummaryProps) {
  const items = [
    { icon: CalendarDays, label: '전체 시즌', tone: 'text-foreground', value: stats.total },
    { icon: CircleCheck, label: '진행 중', tone: 'text-emerald-700', value: stats.active },
    { icon: Flag, label: '수시 시즌', tone: 'text-sky-700', value: stats.early },
    { icon: Trophy, label: '정시 시즌', tone: 'text-amber-700', value: stats.regular },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-md border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className={`mt-1 text-2xl font-semibold tracking-normal ${item.tone}`}>{item.value}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
