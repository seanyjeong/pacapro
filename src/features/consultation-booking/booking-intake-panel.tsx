import { CheckCircle2, Clock3, GraduationCap, MessageSquareText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConsultationFormData } from '@/lib/types/consultation';
import { cn } from '@/lib/utils/cn';

interface BookingIntakePanelProps {
  formData: ConsultationFormData;
}

const REQUIRED_TOTAL = 11;

function hasGrade(value: number | undefined) {
  return value !== undefined;
}

function getRequiredCount(formData: ConsultationFormData) {
  const checks = [
    Boolean(formData.studentName.trim()),
    Boolean(formData.studentPhone?.trim()),
    Boolean(formData.studentGrade),
    Boolean(formData.gender),
    Boolean(formData.studentSchool?.trim()),
    hasGrade(formData.schoolGradeAvg),
    Boolean(formData.admissionType),
    hasGrade(formData.mockTestGrades?.korean),
    hasGrade(formData.mockTestGrades?.math),
    hasGrade(formData.mockTestGrades?.english),
    hasGrade(formData.mockTestGrades?.exploration),
  ];

  return checks.filter(Boolean).length;
}

export function BookingIntakePanel({ formData }: BookingIntakePanelProps) {
  const requiredCount = getRequiredCount(formData);
  const completed = requiredCount === REQUIRED_TOTAL;

  return (
    <aside className="rounded-2xl bg-card p-5" data-testid="booking-intake-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">입력 가이드</h2>
          <p className="text-[13px] text-muted-foreground">소요 1분</p>
        </div>
        <p className={cn('flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums', completed ? 'text-success' : 'text-primary')}>
          <CheckCircle2 className="h-4 w-4" />
          필수 {requiredCount}/{REQUIRED_TOTAL}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', completed ? 'bg-success' : 'bg-primary')}
          style={{ width: `${(requiredCount / REQUIRED_TOTAL) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">필수 정보를 채우면 바로 일정 선택으로 넘어갈 수 있어요.</p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        <GuideRow icon={GraduationCap} title="학생 정보" description="학년, 학교, 내신과 모의고사 등급" />
        <GuideRow icon={Clock3} title="일정 선택" description="가능한 날짜를 고른 뒤 시간을 선택" />
        <GuideRow icon={MessageSquareText} title="문의 내용" description="상담에서 꼭 다룰 내용을 짧게 기록" />
      </ul>
    </aside>
  );
}

function GuideRow({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <li className="flex min-w-0 gap-2.5 rounded-xl bg-muted px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
