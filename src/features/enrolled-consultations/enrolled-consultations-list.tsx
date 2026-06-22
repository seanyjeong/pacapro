import { Loader2 } from 'lucide-react';
import type { Consultation } from '@/lib/types/consultation';
import { EnrolledConsultationRow } from './enrolled-consultation-row';

interface EnrolledConsultationsListProps {
  consultations: Consultation[];
  loading: boolean;
  onOpenDetail: (consultation: Consultation) => void;
  onOpenStatus: (consultation: Consultation) => void;
  onOpenDelete: (consultation: Consultation) => void;
}

export function EnrolledConsultationsList({
  consultations,
  loading,
  onOpenDetail,
  onOpenStatus,
  onOpenDelete,
}: EnrolledConsultationsListProps) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-none">
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          재원생상담 목록을 불러오는 중입니다.
        </div>
      ) : consultations.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">상담 내역이 없습니다</p>
          <p className="mt-1 text-xs text-muted-foreground">검색어나 필터를 조정해 주세요.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
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
    </section>
  );
}
