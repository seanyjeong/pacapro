import Link from 'next/link';
import { ArrowLeft, CalendarOff, CheckCircle2, Clock3, ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsHeaderProps {
  academyName: string;
  blockedCount: number;
  isEnabled?: boolean;
  originalSlug: string;
  weeklyAvailableCount: number;
}

export function SettingsHeader({
  academyName,
  blockedCount,
  isEnabled,
  originalSlug,
  weeklyAvailableCount,
}: SettingsHeaderProps) {
  return (
    <header className="rounded-md border border-border bg-card px-5 py-4 shadow-none">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            <Link2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Reservation Desk</p>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">상담 예약 설정</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {academyName || '학원'} 상담 예약 링크, 운영 시간, 신청 양식을 관리합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[390px]">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <span>예약 상태</span>
              </div>
              <p className="mt-1 font-semibold text-foreground">{isEnabled ? '공개' : '비공개'}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <span>운영 요일</span>
              </div>
              <p className="mt-1 font-semibold text-foreground">{weeklyAvailableCount}일</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarOff className="h-4 w-4" />
                <span>차단 날짜</span>
              </div>
              <p className="mt-1 font-semibold text-foreground">{blockedCount}건</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/consultations">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                상담 목록
              </Button>
            </Link>
            {originalSlug ? (
              <Link href={`/c/${originalSlug}`} target="_blank">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  예약 페이지
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
