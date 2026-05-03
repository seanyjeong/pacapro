'use client';

import { Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Consultation } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS, LEARNING_TYPE_LABELS } from '@/lib/types/consultation';

interface ConductHeaderProps {
  consultation: Consultation;
  backUrl: string;
  backLabel: string;
  progressPercent: number;
  saving: boolean;
  onSave: () => void;
}

export function ConductHeader({
  consultation, backUrl, backLabel, progressPercent, saving, onSave
}: ConductHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={backUrl}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backLabel}
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                {consultation.consultation_type === 'learning' ? '재원생 상담' : '상담 진행'}: {consultation.student_name} ({consultation.student_grade})
                {consultation.consultation_type === 'learning' && consultation.learning_type && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {consultation.preferred_time}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
              {CONSULTATION_STATUS_LABELS[consultation.status]}
            </Badge>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </div>
        </div>

        {/* 진행률 - 신규 상담에만 표시 */}
        {consultation.consultation_type !== 'learning' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">진행률</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
