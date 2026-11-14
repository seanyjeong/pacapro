import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface PaymentEditorShellProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}

export function PaymentEditorShell({ title, subtitle, onBack, children }: PaymentEditorShellProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기" className="-ml-2 mt-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader className="min-w-0 flex-1" title={title} description={subtitle} />
      </div>
      {children}
    </div>
  );
}
