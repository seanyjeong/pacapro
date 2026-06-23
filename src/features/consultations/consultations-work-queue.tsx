'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock3, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  activeStatus: string;
  confirmedCount: number;
  pendingCount: number;
  totalCount: number;
  onFilterConfirmed: () => void;
  onFilterPending: () => void;
  onOpenDirectRegister: () => void;
}

export function ConsultationsWorkQueue({
  activeStatus,
  confirmedCount,
  pendingCount,
  totalCount,
  onFilterConfirmed,
  onFilterPending,
  onOpenDirectRegister,
}: Props) {
  const followUpCount = Math.max(totalCount - pendingCount - confirmedCount, 0);

  return (
    <aside className="space-y-4" data-testid="consultations-work-queue">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">오늘 상담 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">확인 필요 {pendingCount}건, 확정 {confirmedCount}건</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <QueueRow
            ariaLabel="확인 필요 보기"
            label="확인 필요"
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
          <QueueRow label="후속 처리" value={`${followUpCount}건`} />
        </div>

        <Button className="mt-4 w-full rounded-md" onClick={onOpenDirectRegister}>
          <UserPlus className="mr-2 h-4 w-4" />
          상담 등록 시작
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
        <div className="mt-3 grid gap-2">
          <Link href="/consultations/calendar">
            <Button variant="outline" className="w-full justify-start rounded-md">
              <CalendarDays className="mr-2 h-4 w-4" />
              상담 달력
            </Button>
          </Link>
          <Link href="/consultations/new-inquiry">
            <Button variant="outline" className="w-full justify-start rounded-md">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              신규상담 전용 화면
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button variant="outline" className="w-full justify-start rounded-md">
              <Settings className="mr-2 h-4 w-4" />
              상담 시간 설정
            </Button>
          </Link>
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
    'flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm',
    onClick && 'text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
    pressed && 'border-primary/40 bg-primary/5'
  );
  const content = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-semibold text-foreground">{value}</strong>
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
