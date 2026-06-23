import { Check, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ClassDaySlot } from '@/lib/types/student';
import { WEEKDAY_MAP, WEEKDAY_OPTIONS } from '@/lib/types/student';
import { cn } from '@/lib/utils';
import type { TimeSlot } from './class-days-types';

const TIME_SLOT_OPTIONS: Array<{ value: TimeSlot; label: string }> = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

const DAY_PRESETS: Array<{ label: string; slots: ClassDaySlot[] }> = [
  {
    label: '월/수/금 프리셋',
    slots: [
      { day: 1, timeSlot: 'evening' },
      { day: 3, timeSlot: 'evening' },
      { day: 5, timeSlot: 'evening' },
    ],
  },
  {
    label: '화/목 프리셋',
    slots: [
      { day: 2, timeSlot: 'evening' },
      { day: 4, timeSlot: 'evening' },
    ],
  },
  {
    label: '평일 프리셋',
    slots: [1, 2, 3, 4, 5].map((day) => ({ day, timeSlot: 'evening' })),
  },
];

interface ClassDaysBulkEditorProps {
  selectedCount: number;
  slots: ClassDaySlot[];
  onApply: () => void;
  onChangeTimeSlot: (dayValue: number, timeSlot: TimeSlot) => void;
  onClearSelection: () => void;
  onToggleDay: (dayValue: number) => void;
  onUsePreset: (slots: ClassDaySlot[]) => void;
}

export function ClassDaysBulkEditor({
  selectedCount,
  slots,
  onApply,
  onChangeTimeSlot,
  onClearSelection,
  onToggleDay,
  onUsePreset,
}: ClassDaysBulkEditorProps) {
  const selectedDays = new Set(slots.map((slot) => slot.day));
  const sortedSlots = [...slots].sort(sortSlotsMondayFirst);
  const canApply = selectedCount > 0 && sortedSlots.length > 0;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">선택 학생 일괄 변경</h2>
            <Badge variant={selectedCount > 0 ? 'secondary' : 'outline'}>{selectedCount}명 선택</Badge>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="수업일 프리셋">
            {DAY_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                className="h-8 px-2.5 text-xs"
                type="button"
                variant="outline"
                onClick={() => onUsePreset(preset.slots)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((option) => {
              const isActive = selectedDays.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`일괄 ${option.label}요일 선택`}
                  aria-pressed={isActive}
                  onClick={() => onToggleDay(option.value)}
                  className={cn(
                    'h-9 w-9 rounded-md border text-xs font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {sortedSlots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortedSlots.map((slot) => (
                <label key={slot.day} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">{WEEKDAY_MAP[slot.day]}</span>
                  <select
                    aria-label={`일괄 ${WEEKDAY_MAP[slot.day]}요일 시간대`}
                    className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                    value={slot.timeSlot}
                    onChange={(event) => onChangeTimeSlot(slot.day, event.target.value as TimeSlot)}
                  >
                    {TIME_SLOT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectedCount > 0 ? (
            <Button className="gap-2" type="button" variant="ghost" onClick={onClearSelection}>
              <X className="h-4 w-4" />
              선택 해제
            </Button>
          ) : null}
          <Button className="gap-2" disabled={!canApply} type="button" onClick={onApply}>
            <Check className="h-4 w-4" />
            선택 학생에 적용
          </Button>
        </div>
      </div>
    </section>
  );
}

function sortSlotsMondayFirst(a: { day: number }, b: { day: number }) {
  return (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day);
}
