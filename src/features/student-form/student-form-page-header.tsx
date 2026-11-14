import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface StudentFormPageHeaderProps {
  backLabel?: string;
  description: string;
  onBack: () => void;
  title: string;
}

export function StudentFormPageHeader({
  backLabel = '목록으로',
  description,
  onBack,
  title,
}: StudentFormPageHeaderProps) {
  return (
    <div>
      <Button className="-ml-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>
      <PageHeader title={title} description={description} />
    </div>
  );
}
