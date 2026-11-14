'use client';

// tablet/consultations/[id]/conduct/_components/TabletConductHeader.tsx — 헤더 + 진행률 바 (ADR-018)

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page';
import type { Consultation } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS, LEARNING_TYPE_LABELS } from '@/lib/types/consultation';

interface TabletConductHeaderProps {
  consultation: Consultation;
  progressPercent: number;
  backLabel: string;
  onBack: () => void | Promise<void>;
}

export function TabletConductHeader({
  consultation,
  progressPercent,
  backLabel,
  onBack,
}: TabletConductHeaderProps) {
  return (
    <>
      <Button variant="ghost" className="-ml-2 text-secondary-foreground" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        {backLabel}
      </Button>

      <PageHeader
        title={(
          <span className="flex flex-wrap items-center gap-2">
            {consultation.consultation_type === 'learning' ? '재원생 상담' : '상담 진행'} · {consultation.student_name}
            {consultation.consultation_type === 'learning' && consultation.learning_type && (
              <Badge variant="success" className="text-sm">
                {LEARNING_TYPE_LABELS[consultation.learning_type]}
              </Badge>
            )}
          </span>
        )}
        description={(
          <span className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            <Clock className="ml-2 h-4 w-4" />
            {consultation.preferred_time}
          </span>
        )}
        actions={(
          <Badge className={`px-3 py-1 text-sm ${CONSULTATION_STATUS_COLORS[consultation.status]}`}>
            {CONSULTATION_STATUS_LABELS[consultation.status]}
          </Badge>
        )}
      />

      {consultation.consultation_type !== 'learning' && (
        <section className="rounded-2xl bg-card px-5 py-4" aria-label="진행률">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-secondary-foreground">진행률</span>
            <span className="font-extrabold text-primary tabular-nums">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      )}
    </>
  );
}
