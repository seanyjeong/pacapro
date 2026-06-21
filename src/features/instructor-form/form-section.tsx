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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
