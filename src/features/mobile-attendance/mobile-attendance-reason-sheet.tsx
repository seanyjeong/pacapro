import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MobileSheet, mobileChoiceClass } from '../mobile-home/mobile-screen';
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
    <MobileSheet
      title={title}
      description={reasonSheet.studentName}
      closeLabel="사유 입력 닫기"
      onClose={onCancel}
      onOverlayClick={onCancel}
      testId="mobile-attendance-reason-sheet"
    >
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={reasonSheet.reason === option.value}
            onClick={() => onChange({ ...reasonSheet, reason: option.value, customReason: '' })}
            className={mobileChoiceClass(reasonSheet.reason === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {reasonSheet.reason === '기타' && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-secondary-foreground">사유 입력</span>
          <Textarea
            value={reasonSheet.customReason}
            onChange={(event) => onChange({ ...reasonSheet, customReason: event.target.value })}
            rows={2}
            className="resize-none"
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" size="lg" onClick={onConfirm} disabled={disabled}>
          확인
        </Button>
      </div>
    </MobileSheet>
  );
}
