'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock3, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  confirmedCount: number;
  pendingCount: number;
  totalCount: number;
  onOpenDirectRegister: () => void;
}

export function ConsultationsWorkQueue({
  confirmedCount,
  pendingCount,
  totalCount,
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
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">확인 필요</span>
            <strong className="font-semibold text-foreground">{pendingCount}건</strong>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">일정 확정</span>
            <strong className="font-semibold text-foreground">{confirmedCount}건</strong>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">후속 처리</span>
            <strong className="font-semibold text-foreground">{followUpCount}건</strong>
          </div>
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
