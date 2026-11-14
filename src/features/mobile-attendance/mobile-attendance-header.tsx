import { Input } from '@/components/ui/input';
import type { TimeSlot } from '@/lib/types/schedule';
import { MobileSegment } from '../mobile-home/mobile-screen';
import { TIME_SLOT_OPTIONS } from './mobile-attendance-constants';

interface MobileAttendanceHeaderProps {
  date: string;
  timeSlot: TimeSlot;
  roster: React.ReactNode;
  onDateChange: (date: string) => void;
  onTimeSlotChange: (timeSlot: TimeSlot) => void;
}

/** 날짜·시간대·반 고르기. 화면 제목 아래 흰 카드 한 장. */
export function MobileAttendanceHeader({
  date,
  timeSlot,
  roster,
  onDateChange,
  onTimeSlotChange,
}: MobileAttendanceHeaderProps) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4" aria-label="출석 조건">
      <Input
        type="date"
        value={date}
        onChange={(event) => onDateChange(event.target.value)}
        className="dark:[color-scheme:dark]"
        aria-label="출석 날짜"
      />
      <MobileSegment options={TIME_SLOT_OPTIONS} value={timeSlot} onChange={onTimeSlotChange} label="수업 시간대" />
      {roster}
    </section>
  );
}
