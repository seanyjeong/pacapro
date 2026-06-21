import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">상담 내역이 없습니다.</div>
        ) : (
          <div className="divide-y">
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
      </CardContent>
    </Card>
  );
}
