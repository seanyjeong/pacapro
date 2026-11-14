import { SectionCard } from '@/components/ui/page';

interface TabletStudentMemoCardProps {
  memo: string | null;
}

export function TabletStudentMemoCard({ memo }: TabletStudentMemoCardProps) {
  if (!memo) return null;

  return (
    <SectionCard title="메모">
      <p className="whitespace-pre-wrap text-[15px] text-secondary-foreground">{memo}</p>
    </SectionCard>
  );
}
