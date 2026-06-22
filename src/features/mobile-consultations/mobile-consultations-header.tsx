import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileConsultationsHeaderProps {
  selectedDateLabel: string;
  showCalendar: boolean;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onToggleCalendar: () => void;
}

export function MobileConsultationsHeader({
  selectedDateLabel,
  showCalendar,
  loading,
  onBack,
  onRefresh,
  onToggleCalendar,
}: MobileConsultationsHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="모바일 홈으로 이동" className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={onToggleCalendar}
          aria-expanded={showCalendar}
          className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">오늘 상담</h1>
            <Calendar className={`h-4 w-4 shrink-0 ${showCalendar ? 'text-emerald-500' : 'text-zinc-500'}`} />
          </div>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{selectedDateLabel}</p>
        </button>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="상담 목록 새로고침" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </header>
  );
}
