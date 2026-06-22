interface ReportProgressRowProps {
  label: string;
  value: string;
  percent: number;
  tone: 'primary' | 'success' | 'danger';
}

const BAR_TONES: Record<ReportProgressRowProps['tone'], string> = {
  primary: 'bg-sky-600',
  success: 'bg-emerald-600',
  danger: 'bg-rose-600',
};

export function ReportProgressRow({ label, value, percent, tone }: ReportProgressRowProps) {
  const width = `${Math.max(0, Math.min(percent, 100))}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-muted">
        <div className={`h-full rounded-md ${BAR_TONES[tone]}`} style={{ width }} />
      </div>
    </div>
  );
}
