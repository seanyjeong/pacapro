'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, CalendarOff, CheckCircle2, ClipboardList, Clock3, ExternalLink } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface SettingsOperationsBoardProps {
  blockedCount: number;
  hasSavedWeeklyHours: boolean;
  isEnabled?: boolean;
  originalSlug: string;
  referralCount: number;
  weeklyAvailableCount: number;
}

export function SettingsOperationsBoard({
  blockedCount,
  hasSavedWeeklyHours,
  isEnabled,
  originalSlug,
  referralCount,
  weeklyAvailableCount,
}: SettingsOperationsBoardProps) {
  const statusText = isEnabled ? '예약 공개' : '예약 비공개';
  const timeStatus = hasSavedWeeklyHours ? '상담 시간 설정 정상' : '상담 시간 저장 필요';

  return (
    <div className="space-y-4" data-testid="consultation-settings-operations-board">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${hasSavedWeeklyHours ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {hasSavedWeeklyHours ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">상담 설정 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">{statusText}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <BoardRow label="예약 상태" value={isEnabled ? '공개' : '비공개'} />
          <BoardRow label="저장된 운영 요일" value={`${hasSavedWeeklyHours ? weeklyAvailableCount : 0}일`} />
          <BoardRow label="차단 날짜" value={`${blockedCount}건`} />
          <BoardRow label="유입 경로" value={`${referralCount}개`} />
        </div>

        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${hasSavedWeeklyHours ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
          <p className="font-semibold">{timeStatus}</p>
          <p className="mt-1 text-xs">
            {hasSavedWeeklyHours ? '신규상담 시간 선택에 저장된 운영 요일이 반영됩니다.' : '운영 시간을 저장해야 신규상담 시간 선택이 안정적으로 열립니다.'}
          </p>
          <Link
            href="#consultation-weekly-hours"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 w-full justify-start gap-2 bg-background')}
          >
            <Clock3 className="h-4 w-4" />
            운영시간 설정으로 이동
          </Link>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
        <div className="mt-3 space-y-2">
          <Link href="/consultations/new-inquiry" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')}>
            <CalendarDays className="h-4 w-4" />
            신규상담 등록
          </Link>
          <Link href="/consultations/calendar" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')}>
            <CalendarDays className="h-4 w-4" />
            상담 달력
          </Link>
          <Link href="/consultations" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')}>
            <ClipboardList className="h-4 w-4" />
            상담 목록
          </Link>
          {originalSlug ? (
            <Link href={`/c/${originalSlug}`} target="_blank" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2')}>
              <ExternalLink className="h-4 w-4" />
              예약 페이지 확인
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            저장된 운영 요일
          </span>
          <strong className="text-sm text-foreground">{hasSavedWeeklyHours ? weeklyAvailableCount : 0}일</strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarOff className="h-4 w-4" />
            차단 날짜
          </span>
          <strong className="text-sm text-foreground">{blockedCount}건</strong>
        </div>
      </section>
    </div>
  );
}

function BoardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
