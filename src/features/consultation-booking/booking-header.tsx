import type { ConsultationPageInfo } from '@/lib/types/consultation';

interface BookingHeaderProps {
  pageInfo: ConsultationPageInfo;
}

export function BookingHeader({ pageInfo }: BookingHeaderProps) {
  return (
    <header className="border-b border-slate-200 pb-4 text-center">
      <h1 className="text-2xl font-bold tracking-normal text-slate-950">
        {pageInfo.academy.name} 상담예약
      </h1>
      {pageInfo.settings.pageDescription && (
        <p className="mt-2 text-sm text-slate-500">{pageInfo.settings.pageDescription}</p>
      )}
    </header>
  );
}
