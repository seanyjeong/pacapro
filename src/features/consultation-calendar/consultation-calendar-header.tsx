import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsultationCalendarHeaderProps {
  fromSchedule: boolean;
  onBack: () => void;
}

export function ConsultationCalendarHeader({ fromSchedule, onBack }: ConsultationCalendarHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {fromSchedule ? '수업 스케줄로' : '목록으로'}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">상담 달력</h1>
          <p className="text-muted-foreground">월별 상담 일정을 확인합니다.</p>
        </div>
      </div>
      <Link href="/consultations">
        <Button variant="outline" className="gap-2">
          <List className="h-4 w-4" />
          목록 보기
        </Button>
      </Link>
    </div>
  );
}
