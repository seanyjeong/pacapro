import { CalendarClock, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClassDaysControlBarProps {
  changedCount: number;
  effectiveFrom: string;
  monthOptions: { value: string; label: string }[];
  onEffectiveFromChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}

// 바꾼 수업일을 언제부터 적용할지 고르고 저장한다.
export function ClassDaysControlBar({
  changedCount,
  effectiveFrom,
  monthOptions,
  onEffectiveFromChange,
  onSave,
  saving,
}: ClassDaysControlBarProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-bold text-foreground">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          적용 시작월
        </span>
        <select
          aria-label="적용 시작월"
          className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10 sm:w-[220px]"
          value={effectiveFrom}
          onChange={(event) => onEffectiveFromChange(event.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button className="w-full sm:w-auto" disabled={changedCount === 0 || saving} type="button" onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장 ({changedCount}명)
      </Button>
    </section>
  );
}
