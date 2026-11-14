import type { ReactNode } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';
import type { Consultation } from '@/lib/types/consultation';
import { EnrolledConsultationRow } from './enrolled-consultation-row';

interface EnrolledConsultationsListProps {
  consultations: Consultation[];
  loading: boolean;
  total: number;
  filterBar: ReactNode;
  footer: ReactNode;
  onOpenDetail: (consultation: Consultation) => void;
  onOpenStatus: (consultation: Consultation) => void;
  onOpenDelete: (consultation: Consultation) => void;
}

export function EnrolledConsultationsList({
  consultations,
  loading,
  total,
  filterBar,
  footer,
  onOpenDetail,
  onOpenStatus,
  onOpenDelete,
}: EnrolledConsultationsListProps) {
  return (
    <section className="rounded-2xl bg-card">
      <div className="space-y-4 px-5 pb-2 pt-5 sm:px-6">
        {filterBar}
        <h2 className="text-[17px] font-bold tracking-tight text-foreground">
          상담 목록 <span className="ml-1 font-extrabold text-primary tabular-nums">{total}</span>
        </h2>
      </div>
      <div className="px-5 pb-3 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            재원생상담 목록을 불러오는 중이에요.
          </div>
        ) : consultations.length === 0 ? (
          <EmptyState icon={GraduationCap} title="상담 내역이 없어요" description="검색어나 필터를 바꿔 보세요." />
        ) : (
          <div className="divide-y divide-border/60">
            {consultations.map((consultation) => (
              <EnrolledConsultationRow
                key={consultation.id}
                consultation={consultation}
                onOpenDetail={onOpenDetail}
                onOpenStatus={onOpenStatus}
                onOpenDelete={onOpenDelete}
              />
            ))}
          </div>
        )}
      </div>
      {footer}
    </section>
  );
}
