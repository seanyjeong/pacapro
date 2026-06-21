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
        'ml-0 sm:ml-11 mt-2 p-3 rounded-lg border space-y-2',
        isExcused
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
          : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className={cn('h-4 w-4', isExcused ? 'text-blue-600' : 'text-red-600')} />
        <span
          className={cn(
            'text-sm font-medium',
            isExcused ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'
          )}
        >
          {isExcused ? '공결' : '결석'} 사유
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
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
          placeholder="사유 입력..."
          rows={1}
          className="text-sm resize-none"
        />
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onCancel}>
          취소
        </Button>
        <Button
          size="sm"
          className={cn('h-7 text-xs flex-1', isExcused ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700')}
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
        'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
        selected
          ? isExcused
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-red-500 text-white border-red-500'
          : 'bg-background border-border hover:border-muted-foreground/40'
      )}
    >
      {children}
    </button>
  );
}
