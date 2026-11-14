import type { ConsultationPageInfo } from '@/lib/types/consultation';

interface BookingHeaderProps {
  pageInfo: ConsultationPageInfo;
}

export function BookingHeader({ pageInfo }: BookingHeaderProps) {
  return (
    <header className="pt-2">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[28px]">
        {pageInfo.academy.name} 상담예약
      </h1>
      {pageInfo.settings.pageDescription && (
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{pageInfo.settings.pageDescription}</p>
      )}
    </header>
  );
}
