import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MobileInstructorStats } from './mobile-instructor-types';

interface MobileInstructorHeaderProps {
  date: string;
  formattedDate: string;
  loading: boolean;
  stats: MobileInstructorStats;
  onBack: () => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
}

export function MobileInstructorHeader({
  date,
  formattedDate,
  loading,
  stats,
  onBack,
  onDateChange,
  onRefresh,
}: MobileInstructorHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="모바일 홈으로 이동" className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-normal text-foreground">강사 출근체크</h1>
          <p className="truncate text-sm text-muted-foreground">
            {formattedDate} · {stats.checked}/{stats.total} 체크
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="강사 출근 목록 새로고침" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/40 dark:[color-scheme:dark]"
          aria-label="강사 출근 날짜"
        />
      </div>
    </header>
  );
}
