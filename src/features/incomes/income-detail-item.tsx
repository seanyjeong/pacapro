interface IncomeDetailItemProps {
  label: string;
  value?: string;
  wide?: boolean;
}

export function IncomeDetailItem({ label, value, wide }: IncomeDetailItemProps) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
        {value || '-'}
      </p>
    </div>
  );
}
