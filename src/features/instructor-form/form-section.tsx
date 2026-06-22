import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FormSectionProps {
  title: string;
  visible?: boolean;
  children: ReactNode;
}

export function FormSection({ title, visible = true, children }: FormSectionProps) {
  if (!visible) return null;

  return (
    <Card className="rounded-md">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="text-base tracking-normal">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">{children}</CardContent>
    </Card>
  );
}
