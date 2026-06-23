'use client';

import Link from 'next/link';
import { CalendarPlus, ClipboardList, FileText, ListChecks, Settings, UserCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConsultationCalendarWorkQueueProps {
  confirmedCount: number;
  learningCount: number;
  memoCount: number;
  newInquiryCount: number;
  onCreateLearningToday: () => void;
  pendingCount: number;
  totalCount: number;
}

export function ConsultationCalendarWorkQueue({
  confirmedCount,
  learningCount,
  memoCount,
  newInquiryCount,
  onCreateLearningToday,
  pendingCount,
  totalCount,
}: ConsultationCalendarWorkQueueProps) {
  return (
    <aside className="space-y-4" data-testid="consultation-calendar-work-queue">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <CalendarPlus className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">월간 상담 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              확인 대기 {pendingCount}건, 확정 {confirmedCount}건
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <QueueRow ariaLabel="신규 상담 보기" href="/consultations/new-inquiry" label="신규 상담" value={`${newInquiryCount}건`} />
          <QueueRow ariaLabel="재원생 상담 보기" href="/consultations/enrolled" label="재원생 상담" value={`${learningCount}건`} />
          <QueueRow label="상담 메모" value={`${memoCount}건`} />
        </div>

        <Button className="mt-4 w-full gap-2" onClick={onCreateLearningToday}>
          <UserCheck className="h-4 w-4" />
          오늘 재원생 상담
        </Button>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
        <div className="mt-3 space-y-2">
          <Link href="/consultations/new-inquiry">
            <Button className="w-full justify-start gap-2" variant="outline">
              <UserPlus className="h-4 w-4" />
              신규상담 등록
            </Button>
          </Link>
          <Link href="/consultations">
            <Button className="w-full justify-start gap-2" variant="outline">
              <ClipboardList className="h-4 w-4" />
              상담 목록
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button className="w-full justify-start gap-2" variant="outline">
              <Settings className="h-4 w-4" />
              상담 시간 설정
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListChecks className="h-4 w-4" />
            월간 전체 일정
          </span>
          <strong className="text-sm text-foreground">{totalCount}건</strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            월간 메모
          </span>
          <strong className="text-sm text-foreground">{memoCount}건</strong>
        </div>
      </section>
    </aside>
  );
}

function QueueRow({
  ariaLabel,
  href,
  label,
  value,
}: {
  ariaLabel?: string;
  href?: string;
  label: string;
  value: string;
}) {
  const className = cn(
    'flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm',
    href && 'transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
  );
  const content = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </>
  );

  if (href) {
    return (
      <Link aria-label={ariaLabel || label} className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
