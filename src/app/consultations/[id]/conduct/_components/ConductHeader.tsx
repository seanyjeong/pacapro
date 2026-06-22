'use client';

import { ArrowLeft, CalendarDays, Loader2, Save, UserRound } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Consultation } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS, LEARNING_TYPE_LABELS } from '@/lib/types/consultation';

interface ConductHeaderProps {
  consultation: Consultation;
  backLabel: string;
  progressPercent: number;
  saving: boolean;
  onBack: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
}

export function ConductHeader({
  consultation, backLabel, progressPercent, saving, onBack, onSave
}: ConductHeaderProps) {
  const isLearning = consultation.consultation_type === 'learning';
  const title = isLearning ? '재원생 상담' : '상담 진행';

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="outline" size="sm" className="mt-1 shrink-0 gap-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Consultation Desk</p>
              <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-2xl font-semibold tracking-normal text-foreground">
                <span>{title}</span>
                <span className="min-w-0 truncate">· {consultation.student_name}</span>
                <span className="text-muted-foreground">({consultation.student_grade})</span>
                {isLearning && consultation.learning_type && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                  </Badge>
                )}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {consultation.preferred_time}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4" />
                  {consultation.student_school || '학교 미입력'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
              {CONSULTATION_STATUS_LABELS[consultation.status]}
            </Badge>
            {!isLearning ? (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">진행률</span>
                <span className="ml-2 font-semibold text-foreground">{progressPercent}%</span>
              </div>
            ) : null}
            <Button className="gap-2" onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              저장
            </Button>
          </div>
        </div>

        {!isLearning ? (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
