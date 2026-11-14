import { StatTile } from '@/components/ui/page';
import { cn } from '@/lib/utils';

interface ClassDaysSummaryProps {
  changedCount: number;
  scheduledCount: number;
  showScheduledOnly: boolean;
  totalCount: number;
  onToggleScheduledOnly: () => void;
}

// 수업일 숫자 요약. '예약 변경'을 누르면 예약된 학생만 본다.
export function ClassDaysSummary({
  changedCount,
  scheduledCount,
  showScheduledOnly,
  totalCount,
  onToggleScheduledOnly,
}: ClassDaysSummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" data-testid="class-days-operations-board">
      <StatTile className="p-4 sm:p-5" label="전체 학생" value={`${totalCount}명`} />
      <StatTile
        className="p-4 sm:p-5"
        label="변경 대기"
        value={`${changedCount}명`}
        tone={changedCount > 0 ? 'primary' : 'neutral'}
        note={changedCount > 0 ? '저장 전이에요' : undefined}
      />
      <button
        type="button"
        aria-label="예약 변경 보기"
        aria-pressed={showScheduledOnly}
        onClick={onToggleScheduledOnly}
        className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
      >
        <StatTile
          className={cn('h-full p-4 sm:p-5', showScheduledOnly && 'bg-warning-soft')}
          label="예약 변경"
          value={`${scheduledCount}명`}
          tone="warning"
          note={showScheduledOnly ? '예약만 보는 중' : '눌러서 보기'}
        />
      </button>
    </div>
  );
}
