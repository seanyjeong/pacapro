import { Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { MobileIconButton } from '../mobile-home/mobile-screen';

interface MobileConsultationsHeaderProps {
  showCalendar: boolean;
  loading: boolean;
  onRefresh: () => void;
  onToggleCalendar: () => void;
}

/** 뒤로 가기 줄 오른쪽 버튼: 달력 열기·새로고침 */
export function MobileConsultationsHeader({
  showCalendar,
  loading,
  onRefresh,
  onToggleCalendar,
}: MobileConsultationsHeaderProps) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggleCalendar}
        aria-expanded={showCalendar}
        aria-label={showCalendar ? '달력 닫기' : '달력에서 날짜 고르기'}
        className={cn(showCalendar && 'bg-primary-soft text-primary hover:bg-primary-soft')}
      >
        <Calendar className="h-5 w-5" />
      </Button>
      <MobileIconButton label="상담 목록 새로고침" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
      </MobileIconButton>
    </>
  );
}
