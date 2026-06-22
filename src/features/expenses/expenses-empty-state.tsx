import { Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ExpensesEmptyStateProps {
  hasSearch: boolean;
}

export function ExpensesEmptyState({ hasSearch }: ExpensesEmptyStateProps) {
  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardContent className="px-5 py-12 text-center">
        <Banknote className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">
          {hasSearch ? '검색 결과가 없습니다' : '등록된 지출이 없습니다'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasSearch ? '검색어를 바꾸면 다른 지출 내역을 확인할 수 있습니다.' : '지출을 등록하면 월별 운영비가 여기에 표시됩니다.'}
        </p>
      </CardContent>
    </Card>
  );
}
