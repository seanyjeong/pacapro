import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileUnpaidHeaderProps {
  dayName: string;
  loading: boolean;
  query: string;
  onBack: () => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
}

export function MobileUnpaidHeader({
  dayName,
  loading,
  query,
  onBack,
  onQueryChange,
  onRefresh,
}: MobileUnpaidHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="모바일 홈으로 이동" className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">오늘 출석 미납자</h1>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {dayName ? `${dayName}요일 수업 학생 중` : '오늘 수업 학생 중'}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="미납 목록 새로고침" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
          placeholder="학생명, 연락처, 월 검색"
          aria-label="미납 학생 검색"
        />
      </div>
    </header>
  );
}
