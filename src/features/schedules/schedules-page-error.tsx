import { ScheduleErrorPanel } from './schedule-page-states';

interface SchedulesErrorProps {
  message: string;
  onRetry: () => void;
}

export function SchedulesError({ message, onRetry }: SchedulesErrorProps) {
  return (
    <ScheduleErrorPanel message={message} onRetry={onRetry} title="수업 일정을 불러오지 못했습니다" />
  );
}
