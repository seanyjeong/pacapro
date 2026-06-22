interface ClassDaysHeaderProps {
  description?: string;
  totalCount?: number;
}

export function ClassDaysHeader({ description, totalCount }: ClassDaysHeaderProps) {
  const summary = description || `재원생 ${totalCount ?? 0}명의 수업 요일을 관리합니다.`;

  return (
    <header className="border-b border-border/70 pb-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Class Days</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업일 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
    </header>
  );
}
