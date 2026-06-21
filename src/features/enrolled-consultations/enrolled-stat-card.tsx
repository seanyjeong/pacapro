import { Card, CardContent } from '@/components/ui/card';

interface EnrolledStatCardProps {
  label: string;
  value: number;
  className?: string;
}

export function EnrolledStatCard({ label, value, className = '' }: EnrolledStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${className}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
