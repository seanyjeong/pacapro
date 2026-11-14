import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface SeasonPageHeaderProps {
  actions?: ReactNode;
  backLabel?: string;
  description?: ReactNode;
  title: ReactNode;
  onBack: () => void;
}

/** 시즌 하위 화면 공통 머리말: 작은 뒤로 버튼 + PageHeader. */
export function SeasonPageHeader({ actions, backLabel = '뒤로', description, title, onBack }: SeasonPageHeaderProps) {
  return (
    <div>
      <Button className="-ml-2 gap-1 px-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>
      <PageHeader actions={actions} description={description} title={title} />
    </div>
  );
}
