import { AlertCircle, HelpCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ABSENT_REASONS, EXCUSED_REASONS } from './attendance-checker-constants';
import type { ReasonModalData } from './attendance-checker-types';

interface AttendanceReasonModalProps {
  data: ReasonModalData;
  onChange: (data: ReasonModalData) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AttendanceReasonModal({
  data,
  onChange,
  onCancel,
  onConfirm,
}: AttendanceReasonModalProps) {
  const isExcused = data.status === 'excused';
  const reasons = isExcused ? EXCUSED_REASONS : ABSENT_REASONS;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className={cn('h-5 w-5', isExcused ? 'text-blue-500' : 'text-red-500')} />
            {isExcused ? '공결 사유 입력' : '결석 사유 입력'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center py-2">
            <p className="font-medium text-lg">{data.studentName}</p>
            <Badge
              variant="outline"
              className={cn(
                'mt-1',
                isExcused
                  ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'
              )}
            >
              {isExcused ? '공결' : '결석'}
            </Badge>
          </div>

          {isExcused ? <ExcusedHelp /> : <AbsentHelp />}

          <div className="space-y-2">
            <label className="text-sm font-medium">사유 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((option) => (
                <ReasonChoice
                  key={option.value}
                  selected={data.reason === option.value}
                  isExcused={isExcused}
                  onClick={() => onChange({ ...data, reason: option.value, customReason: '' })}
                >
                  {option.label}
                </ReasonChoice>
              ))}
              <ReasonChoice
                selected={data.reason === '기타'}
                isExcused={isExcused}
                className="col-span-2"
                onClick={() => onChange({ ...data, reason: '기타', customReason: '' })}
              >
                기타 (직접 입력)
              </ReasonChoice>
            </div>
          </div>

          {data.reason === '기타' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">사유 입력</label>
              <Textarea
                value={data.customReason}
                onChange={(event) => onChange({ ...data, customReason: event.target.value })}
                placeholder="사유를 입력하세요..."
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            취소
          </Button>
          <Button
            className={cn('flex-1', isExcused ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700')}
            onClick={onConfirm}
            disabled={!data.reason || (data.reason === '기타' && !data.customReason.trim())}
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExcusedHelp() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-semibold mb-1">공결이란?</p>
          <p className="text-blue-700 dark:text-blue-400">
            <strong>공식적 결석</strong>으로, 원장님의 승인이 필요합니다.
          </p>
          <p className="text-blue-600 dark:text-blue-500 mt-1">
            승인되지 않은 결석은 <strong>일반 결석</strong>으로 처리됩니다.
          </p>
          <p className="text-blue-600 dark:text-blue-500 mt-1 text-xs">
            공결은 출석으로 인정되지 않으며, 정산 시 기준에 따라 반영됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function AbsentHelp() {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-800 dark:text-red-300">
          <p className="font-semibold mb-1">결석 안내</p>
          <p className="text-red-700 dark:text-red-400">
            일반 결석은 <strong>학생 본인 책임</strong>이며, 별도의 보상이 없습니다.
          </p>
          <p className="text-red-600 dark:text-red-500 mt-1 text-xs">
            공식적 사유가 있는 경우 공결로 선택해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ReasonChoiceProps {
  selected: boolean;
  isExcused: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function ReasonChoice({ selected, isExcused, onClick, children, className }: ReasonChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-3 border rounded-lg text-sm font-medium transition-all',
        selected
          ? isExcused
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'border-border hover:border-muted-foreground/40',
        className
      )}
    >
      {children}
    </button>
  );
}
