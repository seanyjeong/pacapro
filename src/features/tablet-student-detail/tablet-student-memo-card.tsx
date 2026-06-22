interface TabletStudentMemoCardProps {
  memo: string | null;
}

export function TabletStudentMemoCard({ memo }: TabletStudentMemoCardProps) {
  if (!memo) return null;

  return (
    <section className="rounded-md border border-border bg-background p-5">
      <h2 className="mb-2 font-semibold text-foreground">메모</h2>
      <p className="whitespace-pre-wrap text-muted-foreground">{memo}</p>
    </section>
  );
}
