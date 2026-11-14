import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page';
import { formatReportMonthLabel } from './reports-header';

interface ReportsLoadingStateProps {
  selectedMonth: string;
}

export function ReportsLoadingState({ selectedMonth }: ReportsLoadingStateProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:max-w-7xl" aria-busy="true">
      <PageHeader
        title="리포트"
        description={`${formatReportMonthLabel(selectedMonth)} 리포트를 불러오고 있어요.`}
        actions={<Skeleton className="h-11 w-40 rounded-xl" />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
