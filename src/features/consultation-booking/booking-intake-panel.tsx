import { CheckCircle2, Clock3, GraduationCap, MessageSquareText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConsultationFormData } from '@/lib/types/consultation';

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
    <aside className="rounded-md border border-border bg-card lg:sticky lg:top-5" data-testid="booking-intake-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="mt-1 text-sm font-semibold text-foreground">입력 가이드</h2>
        <p className="mt-1 text-xs text-muted-foreground">소요 1분</p>
      </div>

      <div className="space-y-3 p-4">
        <div className={`rounded-md border px-3 py-3 ${completed ? 'border-success/30 bg-success-soft' : 'border-primary/30 bg-primary-soft'}`}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${completed ? 'text-success' : 'text-primary'}`} />
            <div>
              <p className={`text-sm font-semibold ${completed ? 'text-success' : 'text-primary'}`}>
                필수 {requiredCount}/{REQUIRED_TOTAL}
              </p>
              <p className={`mt-1 text-xs leading-5 ${completed ? 'text-success' : 'text-primary'}`}>
                필수 정보를 채우면 바로 일정 선택으로 넘어갈 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <GuideRow icon={GraduationCap} title="학생 정보" description="학년, 학교, 내신과 모의고사 등급" />
        <GuideRow icon={Clock3} title="일정 선택" description="가능한 날짜를 고른 뒤 시간을 선택" />
        <GuideRow icon={MessageSquareText} title="문의 내용" description="상담에서 꼭 다룰 내용을 짧게 기록" />
      </div>
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
    <div className="flex min-w-0 gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
