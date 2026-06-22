'use client';

// tablet/consultations/[id]/conduct/_components/TabletConductHeader.tsx — 헤더 + 진행률 바 (ADR-018)

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      <Card className="rounded-md p-4 shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Button variant="outline" size="lg" className="h-11 shrink-0 gap-2" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
              {backLabel}
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Tablet Consultation Desk</p>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-normal text-foreground">
                {consultation.consultation_type === 'learning' ? '재원생 상담' : '상담 진행'} · {consultation.student_name}
                {consultation.consultation_type === 'learning' && consultation.learning_type && (
                  <Badge variant="secondary" className="text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                  </Badge>
                )}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                <Clock className="h-4 w-4 ml-2" />
                {consultation.preferred_time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-sm px-3 py-1 ${CONSULTATION_STATUS_COLORS[consultation.status]}`}>
              {CONSULTATION_STATUS_LABELS[consultation.status]}
            </Badge>
          </div>
        </div>
      </Card>

      {consultation.consultation_type !== 'learning' && (
        <Card className="rounded-md shadow-none">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">진행률</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
