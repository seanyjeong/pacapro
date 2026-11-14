import type { SeasonFormData, SeasonPostFreeAction } from '@/lib/types/season';

interface SeasonAftercareControlProps {
  formData: SeasonFormData;
  onChange: (field: keyof SeasonFormData, value: unknown) => void;
  required?: boolean;
}

const inputClass = 'h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted px-3 text-[15px] font-normal text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-50';

export function SeasonAftercareControl({ formData, onChange, required = false }: SeasonAftercareControlProps) {
  return (
    <section className="rounded-2xl bg-card">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="text-[17px] font-bold tracking-tight text-foreground">시즌 종료 후 처리</h2>
      </div>
      <div className="grid gap-4 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 md:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary-foreground">
          <span>무료 수업 종료일 {required && <span className="text-destructive">*</span>}</span>
          <input
            className={inputClass}
            min={formData.end_date || undefined}
            type="date"
            value={formData.free_lesson_end_date || ''}
            onChange={(event) => {
              onChange('free_lesson_end_date', event.target.value);
              if (!event.target.value) onChange('post_free_action', '');
            }}
          />
          <span className="text-xs font-normal text-muted-foreground">시즌 종료일 이후 이 날짜까지 월 수강료를 청구하지 않습니다.</span>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary-foreground">
          <span>무료 수업 종료 후 {required && <span className="text-destructive">*</span>}</span>
          <select
            className={inputClass}
            disabled={!formData.free_lesson_end_date}
            value={formData.post_free_action || ''}
            onChange={(event) => onChange('post_free_action', event.target.value as SeasonPostFreeAction | '')}
          >
            <option value="">선택해주세요</option>
            <option value="graduate">다음 날 자동 졸업</option>
            <option value="regular">재원 유지 · 다음 달부터 월 수강료 청구</option>
          </select>
          <span className="text-xs font-normal text-muted-foreground">졸업을 선택하면 결제 자동 생성 전에 상태를 변경합니다. 다른 시즌에 재등록한 학생은 제외합니다.</span>
        </label>
      </div>
    </section>
  );
}
