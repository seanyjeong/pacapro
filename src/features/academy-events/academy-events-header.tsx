import Link from 'next/link';
import { CalendarDays, Plus, Settings } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface AcademyEventsHeaderProps {
  canEditEvents: boolean;
  onAddEvent?: () => void;
}

export function AcademyEventsHeader({ canEditEvents, onAddEvent }: AcademyEventsHeaderProps) {
  return (
    <PageHeader
      title="학원일정"
      description="업무일정, 학원일정, 휴일을 월 단위로 관리해요."
      actions={
        <>
          <Link className={buttonVariants({ variant: 'outline' })} href="/schedules">
            <CalendarDays className="h-4 w-4" />
            수업 일정 확인
          </Link>
          <Link className={buttonVariants({ variant: 'outline' })} href="/consultations/settings">
            <Settings className="h-4 w-4" />
            상담 시간 설정
          </Link>
          {canEditEvents && onAddEvent ? (
            <Button onClick={onAddEvent}>
              <Plus className="h-4 w-4" />
              일정 등록
            </Button>
          ) : null}
        </>
      }
    />
  );
}
