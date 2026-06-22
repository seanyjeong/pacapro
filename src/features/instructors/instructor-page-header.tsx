import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InstructorPageHeaderProps {
  actions?: ReactNode;
  backLabel?: string;
  className?: string;
  description: string;
  eyebrow: string;
  onBack?: () => void;
  title: string;
}

export function InstructorPageHeader({
  actions,
  backLabel = '목록으로',
  className,
  description,
  eyebrow,
  onBack,
  title,
}: InstructorPageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        {onBack ? (
          <Button className="mb-3" size="sm" type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div> : null}
    </header>
  );
}
