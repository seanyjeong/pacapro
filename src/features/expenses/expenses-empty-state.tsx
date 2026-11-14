import { Banknote } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';

interface ExpensesEmptyStateProps {
  hasSearch: boolean;
}

export function ExpensesEmptyState({ hasSearch }: ExpensesEmptyStateProps) {
  return (
    <EmptyState
      icon={Banknote}
      title={hasSearch ? '검색 결과가 없어요' : '등록된 지출이 없어요'}
      description={hasSearch ? '검색어를 바꾸면 다른 지출 내역을 볼 수 있어요.' : '지출을 등록하면 월별 운영비가 여기에 보여요.'}
    />
  );
}
