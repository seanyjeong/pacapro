'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NewInquiryWorkQueueProps {
  activeStatus: string;
  confirmedCount: number;
  hasWeeklyHours: boolean;
  onCreate: () => void;
  onFilterConfirmed: () => void;
  onFilterPending: () => void;
  pendingCount: number;
  registeredCount: number;
  totalCount: number;
}

export function NewInquiryWorkQueue({
  activeStatus,
  confirmedCount,
  hasWeeklyHours,
  onCreate,
  onFilterConfirmed,
  onFilterPending,
  pendingCount,
  registeredCount,
  totalCount,
}: NewInquiryWorkQueueProps) {
  return (
    <aside className="space-y-4" data-testid="new-inquiry-work-queue">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">신규상담 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              확인 대기 {pendingCount}건, 확정 {confirmedCount}건
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <QueueRow
            ariaLabel="확인 대기 보기"
            label="확인 대기"
            pressed={activeStatus === 'pending'}
            value={`${pendingCount}건`}
            onClick={onFilterPending}
          />
          <QueueRow
            ariaLabel="일정 확정 보기"
            label="일정 확정"
            pressed={activeStatus === 'confirmed'}
            value={`${confirmedCount}건`}
            onClick={onFilterConfirmed}
          />
          <QueueRow label="등록 전환" value={`${registeredCount}건`} />
        </div>

        <Button className="mt-4 w-full gap-2" onClick={onCreate}>
          <UserPlus className="h-4 w-4" />
          상담 등록 시작
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${hasWeeklyHours ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {hasWeeklyHours ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {hasWeeklyHours ? '상담 시간 설정 정상' : '상담 시간 설정 필요'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasWeeklyHours ? '요일별 상담 시간이 연결되어 있습니다.' : '요일별 상담 가능 시간을 먼저 등록해야 합니다.'}
            </p>
          </div>
        </div>
        <Link href="/consultations/settings">
          <Button className="mt-4 w-full gap-2" variant="outline">
            <Settings className="h-4 w-4" />
            상담 설정 열기
          </Button>
        </Link>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
        <div className="mt-3 space-y-2">
          <Link href="/consultations">
            <Button className="w-full justify-start gap-2" variant="outline">
              <ClipboardList className="h-4 w-4" />
              상담 관리
            </Button>
          </Link>
          <Link href="/consultations/calendar?type=new">
            <Button className="w-full justify-start gap-2" variant="outline">
              <CalendarDays className="h-4 w-4" />
              신규상담 캘린더
            </Button>
          </Link>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            현재 목록 {totalCount}건 기준으로 후속 처리를 확인합니다.
          </div>
        </div>
      </section>
    </aside>
  );
}

function QueueRow({
  ariaLabel,
  label,
  onClick,
  pressed = false,
  value,
}: {
  ariaLabel?: string;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  value: string;
}) {
  const className = cn(
    'flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm',
    onClick && 'text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
    pressed && 'border-primary/40 bg-primary/5'
  );
  const content = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel || label}
        aria-pressed={pressed}
        className={className}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
