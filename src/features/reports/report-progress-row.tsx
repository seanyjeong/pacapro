interface ReportProgressRowProps {
  label: string;
  value: string;
  percent: number;
  tone: 'primary' | 'success' | 'danger';
  testId?: string;
}

const BAR_TONES: Record<ReportProgressRowProps['tone'], string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-destructive',
};

export function ReportProgressRow({ label, value, percent, tone, testId }: ReportProgressRowProps) {
  const width = `${Math.max(0, Math.min(percent, 100))}%`;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] text-secondary-foreground">{label}</span>
        <span className="text-[15px] font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${BAR_TONES[tone]}`} style={{ width }} />
      </div>
    </div>
  );
}
