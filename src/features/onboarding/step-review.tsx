import { CheckCircle2, Sparkles, UsersRound } from 'lucide-react';
import type { OnboardingFormData, UpdateOnboardingField } from './onboarding-types';
import { formatWon } from './onboarding-utils';

interface StepReviewProps {
  formData: OnboardingFormData;
  updateFormData: UpdateOnboardingField;
}

export function StepReview({ formData, updateFormData }: StepReviewProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border bg-background p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">핵심 설정 요약</h3>
            <p className="text-sm text-muted-foreground">저장 후 설정 메뉴에서 다시 수정할 수 있습니다.</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryItem label="학원명" value={formData.academy_name || '-'} />
          <SummaryItem label="대표 전화" value={formData.phone || '-'} />
          <SummaryItem label="오전반" value={formData.morning_class_time} />
          <SummaryItem label="오후반" value={formData.afternoon_class_time} />
          <SummaryItem label="입시반 주 3회" value={`${formatWon(formData.tuition_settings.exam_tuition['3'] ?? 0)}원`} />
          <SummaryItem
            label="급여 지급일"
            value={formData.salary_payment_day === 0 ? '매월 말일' : `매월 ${formData.salary_payment_day}일`}
          />
          <SummaryItem label="정산 방식" value={formData.salary_month_type === 'current' ? '당월 정산' : '익월 정산'} />
          <SummaryItem label="학원비 납부일" value={`매월 ${formData.tuition_due_day}일`} />
        </dl>
      </section>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 h-4 w-4 rounded border-border text-slate-900 focus-visible:ring-2 focus-visible:ring-primary/30"
            type="checkbox"
            checked={formData.create_sample_data}
            onChange={(event) => updateFormData('create_sample_data', event.target.checked)}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-slate-700" />
              테스트용 샘플 데이터 생성
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              학생, 강사, 시즌 샘플을 만들어 처음 화면을 바로 확인할 수 있습니다.
            </span>
            <span className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
              <UsersRound className="h-3.5 w-3.5" />
              학생 3명, 강사 2명, 시즌 1개
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
