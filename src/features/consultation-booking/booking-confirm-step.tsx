import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConsultationFormData } from '@/lib/types/consultation';

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
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">신청 내용 확인</h2>
      </div>
      <div className="space-y-4 p-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary-soft p-4">
          <p className="text-xs font-medium text-primary">상담 일정</p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {selectedTime}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="이름" value={formData.studentName} />
          <SummaryItem label="연락처" value={formData.studentPhone || ''} />
          <SummaryItem label="학년" value={formData.studentGrade || ''} />
          <SummaryItem label="학교" value={formData.studentSchool || ''} />
          <SummaryItem label="내신 평균" value={formatGrade(formData.schoolGradeAvg)} />
          <SummaryItem label="입시 유형" value={formatAdmission(formData.admissionType)} />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">모의고사 등급</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-secondary-foreground">
            <span>국어 {formatGrade(formData.mockTestGrades?.korean)}</span>
            <span>수학 {formatGrade(formData.mockTestGrades?.math)}</span>
            <span>영어 {formatGrade(formData.mockTestGrades?.english)}</span>
            <span>탐구 {formatGrade(formData.mockTestGrades?.exploration)}</span>
          </div>
        </div>

        {formData.inquiryContent && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-secondary-foreground">
            {formData.inquiryContent}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onBack}>이전</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            상담 신청하기
          </Button>
        </div>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value || '-'}</p>
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
