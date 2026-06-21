import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface HeaderMetricProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export function HeaderMetric({ icon, label, value }: HeaderMetricProps) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant="outline" className="mt-2 justify-center rounded-md px-2 py-1 text-sm">
        {value}
      </Badge>
    </div>
  );
}
