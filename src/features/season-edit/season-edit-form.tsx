import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { ContinuousDiscountType, SeasonFormData, SeasonStatus, SeasonType, TimeSlot } from '@/lib/types/season';
import { OPERATING_DAY_OPTIONS, SEASON_TARGET_GRADES, TIME_SLOT_OPTIONS } from '@/lib/types/season';

interface SeasonEditFormProps {
  error: string | null;
  formData: SeasonFormData;
  onCancel: () => void;
  onChange: (field: keyof SeasonFormData, value: unknown) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleOperatingDay: (day: number) => void;
  onToggleTimeSlot: (grade: string, timeSlot: TimeSlot) => void;
  saving: boolean;
}

const inputClass = 'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';
const statusOptions: Array<{ label: string; value: SeasonStatus }> = [
  { label: '준비중', value: 'draft' },
  { label: '예정', value: 'upcoming' },
  { label: '진행중', value: 'active' },
  { label: '종료', value: 'ended' },
  { label: '취소', value: 'cancelled' },
];

export function SeasonEditForm({
  error,
  formData,
  onCancel,
  onChange,
  onSubmit,
  onToggleOperatingDay,
  onToggleTimeSlot,
  saving,
}: SeasonEditFormProps) {
  useEffect(() => {
    if (!error) return;
    window.requestAnimationFrame(() => {
      document.querySelector('[data-testid="season-edit-error"]')?.scrollIntoView({ block: 'center' });
    });
  }, [error]);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" data-testid="season-edit-error">
          {error}
        </div>
      )}

      <section className="rounded-md border border-border bg-card">
        <SectionHeader title="기본 정보" />
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium text-foreground md:col-span-2">
            시즌명 <span className="text-rose-500">*</span>
            <input className={inputClass} value={formData.season_name} onChange={(event) => onChange('season_name', event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            시즌 타입
            <select className={inputClass} value={formData.season_type} onChange={(event) => onChange('season_type', event.target.value as SeasonType)}>
              <option value="early">수시</option>
              <option value="regular">정시</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            상태
            <select className={inputClass} value={formData.status} onChange={(event) => onChange('status', event.target.value as SeasonStatus)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card">
        <SectionHeader title="기간" />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-foreground">
            비시즌 종강일
            <input className={inputClass} type="date" value={formData.non_season_end_date || ''} onChange={(event) => onChange('non_season_end_date', event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            시즌 시작일 <span className="text-rose-500">*</span>
            <input className={inputClass} type="date" value={formData.start_date} onChange={(event) => onChange('start_date', event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            시즌 종료일 <span className="text-rose-500">*</span>
            <input className={inputClass} type="date" value={formData.end_date} onChange={(event) => onChange('end_date', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card">
        <SectionHeader title="운영 설정" />
        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">운영 요일 <span className="text-rose-500">*</span></p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {OPERATING_DAY_OPTIONS.map((day) => {
                const selected = formData.operating_days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`h-10 rounded-md border text-sm font-semibold transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'}`}
                    onClick={() => onToggleOperatingDay(day.value)}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/70 pt-4">
            <p className="text-sm font-medium text-foreground">학년별 수업 시간대</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {SEASON_TARGET_GRADES.map((grade) => (
                <div key={grade} className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[52px_1fr] sm:items-center">
                  <span className="text-sm font-semibold text-foreground">{grade}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOT_OPTIONS.map((slot) => {
                      const selected = formData.grade_time_slots?.[grade]?.includes(slot.value);
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          className={`h-9 rounded-md border text-sm font-semibold transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'}`}
                          onClick={() => onToggleTimeSlot(grade, slot.value)}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card">
        <SectionHeader title="금액과 연속등록" />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-foreground">
            기본 시즌비 (원)
            <MoneyInput
              value={formData.season_fee}
              onChange={(seasonFee) => onChange('season_fee', seasonFee)}
              className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            할인 타입
            <select className={inputClass} value={formData.continuous_discount_type} onChange={(event) => onChange('continuous_discount_type', event.target.value as ContinuousDiscountType)}>
              <option value="none">없음</option>
              <option value="free">무료</option>
              <option value="rate">할인율 적용</option>
            </select>
          </label>
          {formData.continuous_discount_type === 'rate' && (
            <label className="grid gap-1 text-sm font-medium text-foreground">
              할인율 (%)
              <input
                className={`${inputClass} text-right`}
                min="0"
                max="100"
                type="number"
                value={formData.continuous_discount_rate || ''}
                onChange={(event) => onChange('continuous_discount_rate', event.target.value === '' ? 0 : Number(event.target.value))}
              />
            </label>
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          저장
        </Button>
      </div>
    </form>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}
