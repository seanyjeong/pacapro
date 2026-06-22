import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface SettingsSectionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SettingsSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  contentClassName,
}: SettingsSectionCardProps) {
  return (
    <Card className={cn('rounded-lg border-border/70 shadow-none', className)}>
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/40">
            <Icon className="h-4 w-4 text-foreground" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-normal">{title}</CardTitle>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('px-5 py-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
