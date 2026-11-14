import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';

export function NaesinPlaceholder() {
  return (
    <section className="rounded-2xl bg-card px-6 pb-10 pt-4 text-center">
      <EmptyState icon={BookOpen} title="내신 성적 관리" description="지금은 모의고사·수능 성적 조회부터 운영해요." />
      <Badge variant="secondary">준비 중</Badge>
    </section>
  );
}
