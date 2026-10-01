import type { SeasonFormData, SeasonPostFreeAction } from '@/lib/types/season';

interface SeasonAftercareControlProps {
  formData: SeasonFormData;
  onChange: (field: keyof SeasonFormData, value: unknown) => void;
  required?: boolean;
}

const inputClass = 'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

export function SeasonAftercareControl({ formData, onChange, required = false }: SeasonAftercareControlProps) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">시즌 종료 후 처리</h2>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-foreground">
          무료 수업 종료일 {required && <span className="text-rose-500">*</span>}
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
        <label className="grid gap-1 text-sm font-medium text-foreground">
          무료 수업 종료 후 {required && <span className="text-rose-500">*</span>}
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
