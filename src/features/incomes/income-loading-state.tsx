import { Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function IncomeLoadingState() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <div className="border-b border-border/70 pb-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수입 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">수입 내역을 불러오는 중입니다</p>
      </div>
      <Card className="rounded-md border-border shadow-none">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3">
          <Banknote className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">잠시만 기다려주세요</p>
        </CardContent>
      </Card>
    </div>
  );
}
