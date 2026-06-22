interface SettingsReadonlyFieldProps {
  label: string;
  value?: string;
  loading?: boolean;
}

export function SettingsReadonlyField({ label, value, loading }: SettingsReadonlyFieldProps) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="min-h-10 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
        {loading ? '불러오는 중' : value || '-'}
      </div>
    </div>
  );
}
