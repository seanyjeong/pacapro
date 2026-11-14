import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MobileConsultationsTitleProps {
  showCalendar: boolean;
  onToggleCalendar: () => void;
}

/** 큰 제목 자체가 달력 열기 버튼이다(제목을 누르면 날짜 달력이 열린다). */
export function MobileConsultationsTitle({ showCalendar, onToggleCalendar }: MobileConsultationsTitleProps) {
  return (
    <button
      type="button"
      onClick={onToggleCalendar}
      aria-expanded={showCalendar}
      className="-mx-1 inline-flex items-center gap-2 rounded-xl px-1 text-left transition-colors hover:bg-muted"
    >
      오늘 상담
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', showCalendar ? 'bg-primary-soft text-primary' : 'bg-card text-muted-foreground')}>
        <Calendar className="h-4 w-4" />
      </span>
      <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', showCalendar && 'rotate-180')} />
    </button>
  );
}
