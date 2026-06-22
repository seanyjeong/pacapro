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
    { label: '전체 시즌', value: stats.total },
    { label: '진행 중', value: stats.active },
    { label: '수시 시즌', value: stats.early },
    { label: '정시 시즌', value: stats.regular },
  ];

  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-b border-r border-slate-200 px-4 py-3 last:border-r-0 md:border-b-0">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
