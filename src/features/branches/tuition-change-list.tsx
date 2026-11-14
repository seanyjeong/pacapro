'use client';

import { ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { TuitionChange } from '@/lib/api/branches';
import { STATUS_LABELS, type StudentStatus } from '@/lib/types/student';
import { cn } from '@/lib/utils';

export const formatWon = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

// 바뀌지 않는 학생의 이유
function unchangedReason(change: TuitionChange) {
  if (change.weekly_count <= 0) return '주 수업 횟수가 없어 그대로';
  if (change.new_tuition === null) return `표에 주${change.weekly_count}회 금액이 없어 그대로`;
  return '지금과 같아요';
}

const monthLabel = (yearMonth: string) => `${Number(yearMonth.slice(5, 7))}월`;

// 같이 바뀌는 미납 월 청구. 휴원 학생은 복귀 때 맞추므로 바꾸지 않는다.
function PendingBills({ change }: { change: TuitionChange }) {
  if (change.status === 'paused') {
    return <span className="mt-1 block text-[12px] text-muted-foreground">휴원 중이라 미납 청구는 복귀 때 맞춰요</span>;
  }
  if (change.pending_bills.length === 0) {
    return <span className="mt-1 block text-[12px] text-muted-foreground">바꿀 미납 월 청구 없음</span>;
  }
  return (
    <span className="mt-1 block text-[12px] text-secondary-foreground tabular-nums">
      미납 청구 {change.pending_bills.length}건:{' '}
      {change.pending_bills.map((bill) => `${monthLabel(bill.year_month)} ${formatWon(bill.current_amount)} → ${formatWon(bill.new_amount)}`).join(', ')}
    </span>
  );
}

interface TuitionChangeListProps {
  changes: TuitionChange[];
  selected: Set<number>;
  onToggle: (studentId: number) => void;
}

/** 학생별 지금 → 새 학원비. 바뀌는 학생만 고를 수 있다. 휴대폰에서도 한 줄씩 읽히게 표 대신 목록. */
export function TuitionChangeList({ changes, selected, onToggle }: TuitionChangeListProps) {
  return (
    <ul className="divide-y divide-border/60 rounded-xl bg-muted/60">
      {changes.map((change) => {
        const checkboxId = `tuition-change-${change.student_id}`;
        return (
          <li key={change.student_id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
            {change.changed ? (
              <Checkbox
                id={checkboxId}
                aria-label={`${change.name} 학원비 바꾸기`}
                checked={selected.has(change.student_id)}
                onCheckedChange={() => onToggle(change.student_id)}
              />
            ) : <span className="h-5 w-5 shrink-0" aria-hidden />}
            <label htmlFor={change.changed ? checkboxId : undefined} className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold text-foreground">{change.name}</span>
                <span className="rounded-full bg-card px-2 py-0.5 text-[12px] font-semibold text-secondary-foreground">
                  {STATUS_LABELS[change.status as StudentStatus] ?? change.status}
                </span>
                <span className="text-[13px] text-muted-foreground">주 {change.weekly_count}회</span>
                {change.individual ? (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold text-warning">개별 금액</span>
                ) : null}
              </span>
              {change.changed ? (
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm tabular-nums">
                  <span className="text-muted-foreground">{formatWon(change.current_tuition)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="에서" />
                  <span className={cn('font-bold', selected.has(change.student_id) ? 'text-primary' : 'text-foreground')}>
                    {formatWon(change.new_tuition ?? 0)}
                  </span>
                  {change.discount_rate > 0 && change.new_final_tuition !== null ? (
                    <span className="text-[13px] text-muted-foreground">(할인 {change.discount_rate}% 후 {formatWon(change.new_final_tuition)})</span>
                  ) : null}
                </span>
              ) : null}
              {change.changed ? <PendingBills change={change} /> : null}
              {!change.changed ? (
                <span className="mt-1 block text-[13px] text-muted-foreground tabular-nums">
                  {formatWon(change.current_tuition)} · {unchangedReason(change)}
                </span>
              ) : null}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
