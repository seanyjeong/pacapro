import { Skeleton } from '@/components/ui/skeleton';

interface ReportsLoadingStateProps {
  selectedMonth: string;
}

export function ReportsLoadingState({ selectedMonth }: ReportsLoadingStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" aria-busy="true">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="flex gap-2">
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            {selectedMonth}
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-28 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Skeleton className="h-80 rounded-md" />
        <Skeleton className="h-80 rounded-md" />
      </div>
      <Skeleton className="h-48 rounded-md" />
    </div>
  );
}
