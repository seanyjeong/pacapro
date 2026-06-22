import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AcademyEventsHeaderProps {
  canEditEvents: boolean;
  onAddEvent?: () => void;
}

export function AcademyEventsHeader({ canEditEvents, onAddEvent }: AcademyEventsHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Academy Calendar</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학원일정</h1>
        <p className="mt-1 text-sm text-muted-foreground">업무일정, 학원일정, 휴일 지정을 월 단위로 관리합니다.</p>
      </div>
      {canEditEvents && onAddEvent ? (
        <Button className="gap-2" onClick={onAddEvent}>
          <Plus className="h-4 w-4" />
          일정 등록
        </Button>
      ) : null}
    </header>
  );
}
