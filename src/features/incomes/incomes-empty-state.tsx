import { Banknote, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';

interface IncomesEmptyStateProps {
  hasSearch: boolean;
}

export function IncomesEmptyState({ hasSearch }: IncomesEmptyStateProps) {
  return (
    <EmptyState
      icon={hasSearch ? Search : Banknote}
      title={hasSearch ? '검색 결과가 없습니다' : '이번 달 수입이 없습니다'}
      description={hasSearch ? '검색어를 바꾸거나 월을 다시 선택해주세요.' : '수입이 발생하면 이 화면에 표시됩니다.'}
      className="py-14"
    />
  );
}
