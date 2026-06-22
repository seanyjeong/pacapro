import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentFormPageHeaderProps {
  backLabel?: string;
  description: string;
  eyebrow: string;
  onBack: () => void;
  title: string;
}

export function StudentFormPageHeader({
  backLabel = '목록으로',
  description,
  eyebrow,
  onBack,
  title,
}: StudentFormPageHeaderProps) {
  return (
    <header className="border-b border-border/70 pb-4">
      <Button className="mb-4" size="sm" type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </header>
  );
}
