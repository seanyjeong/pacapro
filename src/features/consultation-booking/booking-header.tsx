import type { ConsultationPageInfo } from '@/lib/types/consultation';

interface BookingHeaderProps {
  pageInfo: ConsultationPageInfo;
}

export function BookingHeader({ pageInfo }: BookingHeaderProps) {
  return (
    <header className="border-b border-border pb-4 text-center">
      <h1 className="text-2xl font-bold tracking-normal text-foreground">
        {pageInfo.academy.name} 상담예약
      </h1>
      {pageInfo.settings.pageDescription && (
        <p className="mt-2 text-sm text-muted-foreground">{pageInfo.settings.pageDescription}</p>
      )}
    </header>
  );
}
