import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarCheck2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConsultationFormData } from '@/lib/types/consultation';
import { BookingActionBar, BookingCard } from './booking-ui';

interface BookingConfirmStepProps {
  error: string | null;
  formData: ConsultationFormData;
  onBack: () => void;
  onSubmit: () => void;
  selectedDate: Date;
  selectedTime: string;
  submitting: boolean;
}

export function BookingConfirmStep({
  error,
  formData,
  onBack,
  onSubmit,
  selectedDate,
  selectedTime,
  submitting,
}: BookingConfirmStepProps) {
  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 rounded-2xl bg-primary-soft p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-primary">
          <CalendarCheck2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-primary">상담 일정</p>
          <p className="mt-0.5 text-lg font-extrabold tracking-tight text-foreground tabular-nums">
            {format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {selectedTime}
          </p>
        </div>
      </section>

      <BookingCard title="신청 내용 확인">
        <dl className="divide-y divide-border/60">
          <SummaryItem label="이름" value={formData.studentName} />
          <SummaryItem label="연락처" value={formData.studentPhone || ''} />
          <SummaryItem label="학년" value={formData.studentGrade || ''} />
          <SummaryItem label="학교" value={formData.studentSchool || ''} />
          <SummaryItem label="내신 평균" value={formatGrade(formData.schoolGradeAvg)} />
          <SummaryItem label="입시 유형" value={formatAdmission(formData.admissionType)} />
        </dl>

        <div className="mt-4">
          <p className="text-[13px] font-semibold text-muted-foreground">모의고사 등급</p>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            <GradeChip label="국어" value={formatGrade(formData.mockTestGrades?.korean)} />
            <GradeChip label="수학" value={formatGrade(formData.mockTestGrades?.math)} />
            <GradeChip label="영어" value={formatGrade(formData.mockTestGrades?.english)} />
            <GradeChip label="탐구" value={formatGrade(formData.mockTestGrades?.exploration)} />
          </div>
        </div>

        {formData.inquiryContent && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-muted-foreground">문의 내용</p>
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted px-4 py-3 text-sm leading-6 text-secondary-foreground">
              {formData.inquiryContent}
            </p>
          </div>
        )}
      </BookingCard>

      <BookingActionBar error={error}>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button size="lg" variant="outline" onClick={onBack}>이전</Button>
          <Button size="lg" onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            상담 신청하기
          </Button>
        </div>
      </BookingActionBar>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-[15px]">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-foreground">{value || '-'}</dd>
    </div>
  );
}

function GradeChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-1 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function formatGrade(value?: number): string {
  if (value === undefined) return '-';
  if (value === -1) return '미응시';
  return `${value}등급`;
}

function formatAdmission(value?: string): string {
  if (value === 'early') return '수시';
  if (value === 'regular') return '정시';
  if (value === 'both') return '수시+정시';
  return '-';
}
