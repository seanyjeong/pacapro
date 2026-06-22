import Link from 'next/link';
import { ArrowLeft, CalendarDays, FileText, List, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsultationCalendarHeaderProps {
  fromSchedule: boolean;
  memoCount: number;
  onBack: () => void;
  totalCount: number;
}

export function ConsultationCalendarHeader({
  fromSchedule,
  memoCount,
  onBack,
  totalCount,
}: ConsultationCalendarHeaderProps) {
  return (
    <header className="rounded-md border border-border bg-card px-5 py-4 shadow-none">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Consultation Calendar</p>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">상담 달력</h1>
            <p className="mt-1 text-sm text-muted-foreground">월별 신규 상담, 재원생 상담, 상담 메모를 날짜 기준으로 확인합니다.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:w-[280px]">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>상담 일정</span>
              </div>
              <p className="mt-1 font-semibold text-foreground">{totalCount}건</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>상담 메모</span>
              </div>
              <p className="mt-1 font-semibold text-foreground">{memoCount}건</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              {fromSchedule ? '수업 스케줄로' : '목록으로'}
            </Button>
            <Link href="/consultations">
              <Button variant="outline" size="sm" className="gap-2">
                <List className="h-4 w-4" />
                상담 목록
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
