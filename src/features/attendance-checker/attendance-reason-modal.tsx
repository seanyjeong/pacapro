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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:pb-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h3 className="flex items-center gap-2 text-[19px] font-bold tracking-tight">
            <AlertCircle className={cn('h-5 w-5', isExcused ? 'text-primary' : 'text-destructive')} />
            {isExcused ? '공결 사유 입력' : '결석 사유 입력'}
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 pb-2">
          <div className="flex items-center gap-2 py-1">
            <p className="text-[17px] font-bold">{data.studentName}</p>
            <Badge variant={isExcused ? 'default' : 'destructive'}>
              {isExcused ? '공결' : '결석'}
            </Badge>
          </div>

          {isExcused ? <ExcusedHelp /> : <AbsentHelp />}

          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-secondary-foreground">사유 선택</label>
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
              <label className="text-[13px] font-semibold text-secondary-foreground">사유 입력</label>
              <Textarea
                value={data.customReason}
                onChange={(event) => onChange({ ...data, customReason: event.target.value })}
                placeholder="사유를 입력해 주세요"
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            취소
          </Button>
          <Button
            className={cn('flex-1', isExcused ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90')}
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
    <div className="rounded-xl bg-primary-soft p-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary">
          <p className="font-semibold mb-1">공결이란?</p>
          <p className="text-primary">
            <strong>공식적 결석</strong>으로, 원장님의 승인이 필요합니다.
          </p>
          <p className="text-primary mt-1">
            승인되지 않은 결석은 <strong>일반 결석</strong>으로 처리됩니다.
          </p>
          <p className="text-primary mt-1 text-xs">
            공결은 출석으로 인정되지 않으며, 정산 시 기준에 따라 반영됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function AbsentHelp() {
  return (
    <div className="rounded-xl bg-destructive-soft p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-sm text-destructive">
          <p className="font-semibold mb-1">결석 안내</p>
          <p className="text-destructive">
            일반 결석은 <strong>학생 본인 책임</strong>이며, 별도의 보상이 없습니다.
          </p>
          <p className="text-destructive mt-1 text-xs">
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
        'h-12 rounded-xl px-3 text-[15px] font-semibold transition-colors',
        selected
          ? isExcused
            ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50'
            : 'bg-destructive-soft text-destructive ring-2 ring-inset ring-destructive/50'
          : 'bg-muted text-secondary-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
}
