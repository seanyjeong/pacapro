import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_INFO } from './time-slot-detail-constants';
import { formatSlotDate } from './time-slot-detail-utils';

interface TimeSlotDetailHeaderProps {
  date: string;
  timeSlot: TimeSlot;
  studentCount: number;
  onClose: () => void;
}

export function TimeSlotDetailHeader({
  date,
  timeSlot,
  studentCount,
  onClose,
}: TimeSlotDetailHeaderProps) {
  const slotInfo = TIME_SLOT_INFO[timeSlot];
  const Icon = slotInfo.icon;
  const { shortDate, dayOfWeek } = formatSlotDate(date);

  return (
    <div className={cn('px-5 py-4 border-b shrink-0', slotInfo.bgColor)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-full bg-background/80 dark:bg-black/30">
            <Icon className={cn('h-5 w-5', slotInfo.color)} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {shortDate} ({dayOfWeek}) {slotInfo.label}반
            </h2>
            <p className="text-sm text-muted-foreground">학생 {studentCount}명</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-background/60 shrink-0"
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
