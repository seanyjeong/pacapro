import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TABLET_ABSENT_REASONS, TABLET_EXCUSED_REASONS } from './tablet-attendance-constants';
import type { TabletReasonState } from './tablet-attendance-types';

interface TabletAttendanceReasonDialogProps {
  reasonState: TabletReasonState | null;
  onCancel: () => void;
  onChange: (reasonState: TabletReasonState) => void;
  onConfirm: () => void;
}

export function TabletAttendanceReasonDialog({
  reasonState,
  onCancel,
  onChange,
  onConfirm,
}: TabletAttendanceReasonDialogProps) {
  if (!reasonState) return null;
  const title = reasonState.status === 'excused' ? '공결 사유' : '결석 사유';
  const options = reasonState.status === 'excused' ? TABLET_EXCUSED_REASONS : TABLET_ABSENT_REASONS;
  const disabled = !reasonState.reason || (reasonState.reason === '기타' && !reasonState.customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <section
        className="w-full max-w-md rounded-lg bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        data-testid="tablet-attendance-reason-dialog"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{reasonState.studentName}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="사유 입력 닫기">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange({ ...reasonState, reason: option.value, customReason: '' })}
              className={`rounded-lg border px-3 py-3 text-sm font-medium transition
                ${reasonState.reason === option.value
                  ? 'border-muted-foreground/40 bg-foreground text-white'
                  : 'border-border bg-muted text-secondary-foreground'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {reasonState.reason === '기타' && (
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-secondary-foreground">사유 입력</span>
            <textarea
              value={reasonState.customReason}
              onChange={(event) => onChange({ ...reasonState, customReason: event.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/40"
            />
          </label>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" className="h-12" onClick={onConfirm} disabled={disabled}>
            확인
          </Button>
        </div>
      </section>
    </div>
  );
}
