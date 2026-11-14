import { Input } from '@/components/ui/input';

interface MobileInstructorHeaderProps {
  date: string;
  onDateChange: (date: string) => void;
}

/** 날짜 고르기 카드 */
export function MobileInstructorHeader({ date, onDateChange }: MobileInstructorHeaderProps) {
  return (
    <section className="rounded-2xl bg-card p-4" aria-label="출근 날짜">
      <Input
        type="date"
        value={date}
        onChange={(event) => onDateChange(event.target.value)}
        className="dark:[color-scheme:dark]"
        aria-label="강사 출근 날짜"
      />
    </section>
  );
}
