'use client';

import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { ListRow } from '@/components/ui/page';
import type { Consultation } from '@/lib/types/consultation';

interface EnrolledConsultationsWorkQueueProps {
  hasWeeklyHours: boolean;
  nextConsultation: Consultation | null;
}

/** 다음 상담 바로 가기와 상담 시간 설정 상태. 숫자는 위 요약 칸에만 있다. */
export function EnrolledConsultationsWorkQueue({ hasWeeklyHours, nextConsultation }: EnrolledConsultationsWorkQueueProps) {
  return (
    <section className="grid gap-x-6 rounded-2xl bg-card px-5 py-2 sm:px-6 lg:grid-cols-2" data-testid="enrolled-consultations-work-queue">
      {nextConsultation ? (
        <ListRow
          icon={ClipboardList}
          tone="primary"
          title={`다음 상담 · ${nextConsultation.student_name}`}
          detail={`${nextConsultation.preferred_date} ${nextConsultation.preferred_time?.slice(0, 5) ?? ''} · 눌러서 상담 진행`}
          href={`/consultations/${nextConsultation.id}/conduct`}
        />
      ) : null}
      <ListRow
        icon={hasWeeklyHours ? CheckCircle2 : AlertTriangle}
        tone={hasWeeklyHours ? 'success' : 'warning'}
        title={hasWeeklyHours ? '상담 시간 설정 정상' : '상담 시간 설정 필요'}
        detail={hasWeeklyHours ? '저장된 요일별 시간이 상담 등록에 쓰여요.' : '요일별 상담 가능 시간을 먼저 저장해야 해요.'}
        href="/consultations/settings"
      />
    </section>
  );
}
