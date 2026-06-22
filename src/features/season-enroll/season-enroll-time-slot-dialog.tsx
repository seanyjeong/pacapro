import { CheckCircle, Clock, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { Season, TimeSlot } from '@/lib/types/season';
import type { SeasonEnrollStudent } from './season-enroll-types';
import { ALL_TIME_SLOTS, formatTimeSlots, formatWon, parseSeasonFee, TIME_SLOT_LABELS } from './season-enroll-utils';

interface SeasonEnrollTimeSlotDialogProps {
  discountAmount: number;
  enrolling: boolean;
  season: Season;
  selectedStudent: SeasonEnrollStudent | null;
  selectedTimeSlots: TimeSlot[];
  onClose: () => void;
  onConfirm: () => void;
  onDiscountChange: (value: number) => void;
  onTimeSlotToggle: (slot: TimeSlot) => void;
}

export function SeasonEnrollTimeSlotDialog({
  discountAmount,
  enrolling,
  season,
  selectedStudent,
  selectedTimeSlots,
  onClose,
  onConfirm,
  onDiscountChange,
  onTimeSlotToggle,
}: SeasonEnrollTimeSlotDialogProps) {
  if (!selectedStudent) return null;

  const baseFee = parseSeasonFee(season);
  const finalFee = Math.max(0, baseFee - discountAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div
        aria-labelledby="season-enroll-dialog-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div className="min-w-0">
            <h3 id="season-enroll-dialog-title" className="text-lg font-semibold text-slate-950">
              시간대 선택
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {selectedStudent.name} · {selectedStudent.grade || selectedStudent.grade_type}
            </p>
          </div>
          <button
            aria-label="닫기"
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
            disabled={enrolling}
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4">
          <div className="grid gap-2">
            {ALL_TIME_SLOTS.map((slot) => {
              const selected = selectedTimeSlots.includes(slot);
              return (
                <button
                  key={slot}
                  className={`flex h-12 items-center justify-between rounded-md border px-3 text-left text-sm transition ${
                    selected
                      ? 'border-slate-900 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                  type="button"
                  onClick={() => onTimeSlotToggle(slot)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    {TIME_SLOT_LABELS[slot]}
                  </span>
                  {selected && <CheckCircle className="h-4 w-4" />}
                </button>
              );
            })}
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            선택된 시간대: {formatTimeSlots(selectedTimeSlots)}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-800" htmlFor="season-enroll-discount">
              할인 금액
            </label>
            <MoneyInput id="season-enroll-discount" value={discountAmount} onChange={onDiscountChange} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">시즌비 {formatWon(baseFee)}</span>
              {discountAmount > 0 && <span className="text-rose-600">할인 {formatWon(discountAmount)}</span>}
              <span className="font-semibold text-slate-950">최종 {formatWon(finalFee)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4">
          <Button className="flex-1" variant="outline" onClick={onClose} disabled={enrolling}>
            취소
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={selectedTimeSlots.length === 0 || enrolling}>
            {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : '등록하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
