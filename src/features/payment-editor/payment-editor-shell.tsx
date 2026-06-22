import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentEditorShellProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}

export function PaymentEditorShell({ title, subtitle, onBack, children }: PaymentEditorShellProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
