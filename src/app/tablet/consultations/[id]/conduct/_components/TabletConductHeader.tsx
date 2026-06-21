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
      {/* 헤더 - 태블릿 최적화 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="lg" className="h-11" onClick={onBack}>
              <ArrowLeft className="h-5 w-5 mr-2" />
              {backLabel}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {consultation.student_name}
                {consultation.consultation_type === 'learning' && consultation.learning_type && (
                  <Badge variant="secondary" className="text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                  </Badge>
                )}
              </h1>
              <p className="text-base text-muted-foreground flex items-center gap-2 mt-1">
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

      {/* 진행률 - 신규 상담에만 표시 */}
      {consultation.consultation_type !== 'learning' && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">진행률</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
