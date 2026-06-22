import { Banknote } from 'lucide-react';

interface ExpensesEmptyStateProps {
  hasSearch: boolean;
}

export function ExpensesEmptyState({ hasSearch }: ExpensesEmptyStateProps) {
  return (
    <section className="rounded-md border border-border bg-card px-5 py-12 text-center shadow-none">
      <Banknote className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold text-foreground">
        {hasSearch ? '검색 결과가 없습니다' : '등록된 지출이 없습니다'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasSearch ? '검색어를 바꾸면 다른 지출 내역을 확인할 수 있습니다.' : '지출을 등록하면 월별 운영비가 여기에 표시됩니다.'}
      </p>
    </section>
  );
}
