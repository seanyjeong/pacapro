import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface InstructorPageHeaderProps {
  actions?: ReactNode;
  backLabel?: string;
  description: string;
  onBack?: () => void;
  title: string;
}

export function InstructorPageHeader({
  actions,
  backLabel = '목록으로',
  description,
  onBack,
  title,
}: InstructorPageHeaderProps) {
  return (
    <div>
      {onBack ? (
        <Button className="-ml-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      ) : null}
      <PageHeader title={title} description={description} actions={actions} />
    </div>
  );
}
