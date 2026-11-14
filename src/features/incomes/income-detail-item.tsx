interface IncomeDetailItemProps {
  label: string;
  value?: string;
  wide?: boolean;
}

export function IncomeDetailItem({ label, value, wide }: IncomeDetailItemProps) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-xl bg-muted px-3 py-2 text-[15px] font-semibold text-foreground">
        {value || '-'}
      </p>
    </div>
  );
}
