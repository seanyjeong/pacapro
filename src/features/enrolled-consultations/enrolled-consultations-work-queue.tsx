'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Settings, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import { cn } from '@/lib/utils/cn';

interface EnrolledConsultationsWorkQueueProps {
  confirmedCount: number;
  hasWeeklyHours: boolean;
  nextConsultation: Consultation | null;
  onCreate: () => void;
  pendingCount: number;
  totalCount: number;
}

export function EnrolledConsultationsWorkQueue({
  confirmedCount,
  hasWeeklyHours,
  nextConsultation,
  onCreate,
  pendingCount,
  totalCount,
}: EnrolledConsultationsWorkQueueProps) {
  const followUpCount = Math.max(totalCount - pendingCount - confirmedCount, 0);

  return (
    <div className="space-y-4" data-testid="enrolled-consultations-work-queue">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">재원생상담 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              확인 대기 {pendingCount}건, 일정 확정 {confirmedCount}건
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <QueueRow label="확인 대기" value={`${pendingCount}건`} />
          <QueueRow label="일정 확정" value={`${confirmedCount}건`} />
          <QueueRow label="후속 처리" value={`${followUpCount}건`} />
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
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              {hasWeeklyHours ? '상담 시간 설정 정상' : '상담 시간 설정 필요'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasWeeklyHours ? '저장된 요일별 시간이 등록 상담에 반영됩니다.' : '요일별 상담 가능 시간을 먼저 저장해야 합니다.'}
            </p>
          </div>
        </div>
      </section>

      {nextConsultation ? (
        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">다음 상담</h2>
          <p className="mt-2 text-sm font-medium text-foreground">{nextConsultation.student_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {nextConsultation.preferred_date} {nextConsultation.preferred_time?.slice(0, 5)}
          </p>
          <Link
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 w-full justify-start gap-2')}
            href={`/consultations/${nextConsultation.id}/conduct`}
          >
            <ClipboardList className="h-4 w-4" />
            상담 진행
          </Link>
        </section>
      ) : null}

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
        <div className="mt-3 space-y-2">
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')} href="/consultations/calendar?type=learning">
            <CalendarDays className="h-4 w-4" />
            상담 달력
          </Link>
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')} href="/consultations/settings">
            <Settings className="h-4 w-4" />
            상담 시간 설정
          </Link>
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')} href="/consultations">
            <ClipboardList className="h-4 w-4" />
            전체 상담 관리
          </Link>
        </div>
      </section>
    </div>
  );
}

function QueueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
