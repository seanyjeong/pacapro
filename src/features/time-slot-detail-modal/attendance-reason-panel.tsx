import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ABSENT_REASONS, EXCUSED_REASONS } from './time-slot-detail-constants';
import type { ReasonInputState } from './time-slot-detail-types';

interface AttendanceReasonPanelProps {
  reasonInput: ReasonInputState;
  onChange: (reasonInput: ReasonInputState) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AttendanceReasonPanel({
  reasonInput,
  onChange,
  onCancel,
  onConfirm,
}: AttendanceReasonPanelProps) {
  const isExcused = reasonInput.status === 'excused';
  const reasons = isExcused ? EXCUSED_REASONS : ABSENT_REASONS;

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl p-3',
        isExcused ? 'bg-primary-soft' : 'bg-destructive-soft'
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className={cn('h-4 w-4', isExcused ? 'text-primary' : 'text-destructive')} />
        <span
          className={cn(
            'text-sm font-medium',
            isExcused ? 'text-primary' : 'text-destructive'
          )}
        >
          {isExcused ? '공결' : '결석'} 사유
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {reasons.map((option) => (
          <ReasonButton
            key={option.value}
            selected={reasonInput.reason === option.value}
            isExcused={isExcused}
            onClick={() => onChange({ ...reasonInput, reason: option.value, customReason: '' })}
          >
            {option.label}
          </ReasonButton>
        ))}
        <ReasonButton
          selected={reasonInput.reason === '기타'}
          isExcused={isExcused}
          onClick={() => onChange({ ...reasonInput, reason: '기타', customReason: '' })}
        >
          기타
        </ReasonButton>
      </div>
      {reasonInput.reason === '기타' && (
        <Textarea
          value={reasonInput.customReason}
          onChange={(event) => onChange({ ...reasonInput, customReason: event.target.value })}
          placeholder="사유 입력"
          rows={1}
          className="resize-none bg-card"
        />
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 bg-card" onClick={onCancel}>
          취소
        </Button>
        <Button
          className={cn('flex-1', isExcused ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90')}
          onClick={onConfirm}
          disabled={!reasonInput.reason || (reasonInput.reason === '기타' && !reasonInput.customReason.trim())}
        >
          확인
        </Button>
      </div>
    </div>
  );
}

interface ReasonButtonProps {
  selected: boolean;
  isExcused: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ReasonButton({ selected, isExcused, onClick, children }: ReasonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-11 rounded-xl px-2 text-sm font-semibold transition-colors',
        selected
          ? isExcused
            ? 'bg-primary text-primary-foreground'
            : 'bg-destructive text-destructive-foreground'
          : 'bg-card text-secondary-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
