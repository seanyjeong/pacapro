import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentDetailHeaderProps {
  actions?: ReactNode;
  description?: string;
  onBack: () => void;
}

export function StudentDetailHeader({ actions, description, onBack }: StudentDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <Button className="mb-2" size="sm" type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Student Profile</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">학생 상세</h1>
        <p className="text-sm text-muted-foreground">
          {description || '학생의 정보, 출결, 납부, 시즌, 상담 기록을 확인합니다.'}
        </p>
      </div>

      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
