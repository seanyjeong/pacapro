interface SettingsReadonlyFieldProps {
  label: string;
  value?: string;
  loading?: boolean;
}

export function SettingsReadonlyField({ label, value, loading }: SettingsReadonlyFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <span className="shrink-0 text-[15px] text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right text-[15px] font-semibold text-foreground">
        {loading ? '불러오는 중' : value || '-'}
      </span>
    </div>
  );
}
