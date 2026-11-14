import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface SchedulePageHeaderProps {
  actions?: ReactNode;
  backLabel?: string;
  className?: string;
  description: string;
  onBack?: () => void;
  title: ReactNode;
}

export function SchedulePageHeader({
  actions,
  backLabel = '목록으로',
  className,
  description,
  onBack,
  title,
}: SchedulePageHeaderProps) {
  return (
    <div className={className}>
      {onBack ? (
        <Button className="-ml-2 gap-1 px-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      ) : null}
      <PageHeader actions={actions} description={description} title={title} />
    </div>
  );
}
