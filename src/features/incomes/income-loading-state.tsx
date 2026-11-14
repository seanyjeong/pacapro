import { Banknote } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/page';

export function IncomeLoadingState() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
      <PageHeader title="수입 관리" description="수입 내역을 불러오는 중이에요." />
      <section className="rounded-2xl bg-card">
        <EmptyState icon={Banknote} title="잠시만 기다려주세요" className="py-14" />
      </section>
    </div>
  );
}
