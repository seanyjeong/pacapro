import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ABSENT_REASONS, EXCUSED_REASONS } from './mobile-attendance-constants';
import type { ReasonSheetState } from './mobile-attendance-types';

interface MobileAttendanceReasonSheetProps {
  reasonSheet: ReasonSheetState | null;
  onCancel: () => void;
  onChange: (next: ReasonSheetState) => void;
  onConfirm: () => void;
}

export function MobileAttendanceReasonSheet({ reasonSheet, onCancel, onChange, onConfirm }: MobileAttendanceReasonSheetProps) {
  if (!reasonSheet) return null;
  const options = reasonSheet.status === 'excused' ? EXCUSED_REASONS : ABSENT_REASONS;
  const title = reasonSheet.status === 'excused' ? '공결 사유' : '결석 사유';
  const disabled = !reasonSheet.reason || (reasonSheet.reason === '기타' && !reasonSheet.customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onCancel}>
      <section
        className="w-full max-w-md rounded-t-2xl bg-white pb-8 shadow-2xl dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
        data-testid="mobile-attendance-reason-sheet"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <div className="space-y-4 px-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{reasonSheet.studentName}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="사유 입력 닫기">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ ...reasonSheet, reason: option.value, customReason: '' })}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition
                  ${reasonSheet.reason === option.value
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {reasonSheet.reason === '기타' && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">사유 입력</span>
              <textarea
                value={reasonSheet.customReason}
                onChange={(event) => onChange({ ...reasonSheet, customReason: event.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
              취소
            </Button>
            <Button type="button" className="h-12" onClick={onConfirm} disabled={disabled}>
              확인
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
