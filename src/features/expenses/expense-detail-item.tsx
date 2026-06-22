interface ExpenseDetailItemProps {
  label: string;
  value: string;
  wide?: boolean;
}

export function ExpenseDetailItem({ label, value, wide }: ExpenseDetailItemProps) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words font-medium text-foreground">{value}</p>
    </div>
  );
}
