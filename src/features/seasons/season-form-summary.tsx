import { CalendarDays, Clock3, Repeat2, WalletCards } from 'lucide-react';
import type { SeasonFormData } from '@/lib/types/season';
import {
  CONTINUOUS_DISCOUNT_TYPE_LABELS,
  formatOperatingDays,
  formatSeasonFee,
  SEASON_TARGET_GRADES,
  TIME_SLOT_LABELS,
} from '@/lib/types/season';

interface SeasonFormSummaryProps {
  formData: SeasonFormData;
}

export function SeasonFormSummary({ formData }: SeasonFormSummaryProps) {
  const period = [formData.start_date || '시작일 미정', formData.end_date || '종료일 미정'].join(' ~ ');
  const nonSeasonEndDate = formData.non_season_end_date ? `비시즌 ${formData.non_season_end_date}` : '비시즌 종강일 미정';
  const operatingDays = formData.operating_days.length > 0 ? formatOperatingDays(formData.operating_days) : '요일 미선택';
  const timeSlotSummary = SEASON_TARGET_GRADES.map((grade) => {
    const slots = formData.grade_time_slots?.[grade] || [];
    const labels = slots.map((slot) => TIME_SLOT_LABELS[slot]).join(', ') || '미선택';
    return `${grade} ${labels}`;
  });
  const discountType = formData.continuous_discount_type || 'none';
  const discount =
    discountType === 'rate' ? `${formData.continuous_discount_rate || 0}%` : CONTINUOUS_DISCOUNT_TYPE_LABELS[discountType];

  const items = [
    { icon: CalendarDays, label: '기간', value: period, subValue: nonSeasonEndDate },
    { icon: Clock3, label: '시간대', value: timeSlotSummary.join(' / '), subValue: '학년별 기본값' },
    { icon: WalletCards, label: '시즌비', value: formatSeasonFee(formData.season_fee), subValue: `연속등록 ${discount}` },
    { icon: Repeat2, label: '운영일', value: operatingDays, subValue: `${formData.operating_days.length}일 선택` },
  ];

  return (
    <section className="rounded-md border border-border bg-card" data-testid="season-form-summary">
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">운영 요약</h2>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="min-w-0 bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
              <p className="mt-2 break-keep text-sm font-semibold text-foreground">{item.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.subValue}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
