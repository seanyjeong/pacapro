import { CheckCircle, Clock, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import type { ProRatedPreview, TimeSlot } from '@/lib/types/season';
import type { SeasonEnrollStudent } from './season-enroll-types';
import { ALL_TIME_SLOTS, formatTimeSlots, formatWon, TIME_SLOT_LABELS } from './season-enroll-utils';

interface SeasonEnrollTimeSlotDialogProps {
  discountAmount: number;
  enrolling: boolean;
  preview: ProRatedPreview | null;
  previewLoading: boolean;
  registrationDate: string;
  seasonEndDate: string;
  seasonFee: number;
  selectedStudent: SeasonEnrollStudent | null;
  selectedTimeSlots: TimeSlot[];
  onClose: () => void;
  onConfirm: () => void;
  onDiscountChange: (value: number) => void;
  onRegistrationDateChange: (value: string) => void;
  onSeasonFeeChange: (value: number) => void;
  onTimeSlotToggle: (slot: TimeSlot) => void;
}

export function SeasonEnrollTimeSlotDialog({
  discountAmount,
  enrolling,
  preview,
  previewLoading,
  registrationDate,
  seasonEndDate,
  seasonFee,
  selectedStudent,
  selectedTimeSlots,
  onClose,
  onConfirm,
  onDiscountChange,
  onRegistrationDateChange,
  onSeasonFeeChange,
  onTimeSlotToggle,
}: SeasonEnrollTimeSlotDialogProps) {
  if (!selectedStudent) return null;

  const midSeason = preview?.mid_season_prorated;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        aria-labelledby="season-enroll-dialog-title"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:pb-0"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
          <div className="min-w-0">
            <h3 id="season-enroll-dialog-title" className="text-[19px] font-bold tracking-tight text-foreground">
              시간대 선택
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedStudent.name} · {selectedStudent.grade || selectedStudent.grade_type}
            </p>
          </div>
          <button
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
            disabled={enrolling}
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-2">
            {ALL_TIME_SLOTS.map((slot) => {
              const selected = selectedTimeSlots.includes(slot);
              return (
                <button
                  key={slot}
                  className={`flex h-12 items-center justify-between rounded-xl px-4 text-left text-[15px] transition ${
                    selected
                      ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50'
                      : 'bg-muted text-secondary-foreground hover:text-foreground'
                  }`}
                  type="button"
                  onClick={() => onTimeSlotToggle(slot)}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Clock className="h-4 w-4" />
                    {TIME_SLOT_LABELS[slot]}
                  </span>
                  {selected && <CheckCircle className="h-4 w-4" />}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-muted px-3 py-2 text-[13px] text-secondary-foreground">
            선택된 시간대: {formatTimeSlots(selectedTimeSlots)}
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-semibold text-secondary-foreground" htmlFor="season-enroll-date">
                등록일 (시즌 시작 후 합류 시 일할계산)
              </label>
              <Input
                id="season-enroll-date"
                max={seasonEndDate}
                type="date"
                value={registrationDate}
                onChange={(event) => onRegistrationDateChange(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[13px] font-semibold text-secondary-foreground" htmlFor="season-enroll-fee">
                  이 학생 시즌비
                </label>
                <MoneyInput id="season-enroll-fee" value={seasonFee} onChange={onSeasonFeeChange} />
              </div>
              <div className="space-y-1">
                <label className="block text-[13px] font-semibold text-secondary-foreground" htmlFor="season-enroll-discount">
                  할인 금액
                </label>
                <MoneyInput id="season-enroll-discount" value={discountAmount} onChange={onDiscountChange} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">시즌비 {formatWon(seasonFee)}</span>
              {midSeason && (
                <span className="text-warning">
                  중간합류 ({midSeason.remaining_days}/{midSeason.total_days}일) -{formatWon(midSeason.discount)}
                </span>
              )}
              {discountAmount > 0 && <span className="text-destructive">할인 {formatWon(discountAmount)}</span>}
              <span className="font-semibold text-foreground">
                최종 {!registrationDate ? '등록일을 골라 주세요' : previewLoading ? '계산 중...' : preview ? formatWon(preview.final_calculation.total_due) : '계산하지 못했습니다'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-1">
          <Button className="flex-1" variant="outline" onClick={onClose} disabled={enrolling}>
            취소
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={selectedTimeSlots.length === 0 || enrolling || previewLoading || !preview}>
            {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : '등록하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
