import { Skeleton } from '@/components/ui/skeleton';

export function SeasonDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" aria-busy="true">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-24 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-md" />
        <Skeleton className="h-56 rounded-md" />
      </div>
      <Skeleton className="h-80 rounded-md" />
    </div>
  );
}
