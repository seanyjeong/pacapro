import { Banknote, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface IncomesEmptyStateProps {
  hasSearch: boolean;
}

export function IncomesEmptyState({ hasSearch }: IncomesEmptyStateProps) {
  const Icon = hasSearch ? Search : Banknote;
  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {hasSearch ? '검색 결과가 없습니다' : '이번 달 수입이 없습니다'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasSearch ? '검색어를 바꾸거나 월을 다시 선택해주세요.' : '수입이 발생하면 이 화면에 표시됩니다.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
