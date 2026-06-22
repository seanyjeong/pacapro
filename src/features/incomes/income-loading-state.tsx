import { Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function IncomeLoadingState() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">수입 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">수입 내역을 불러오는 중입니다</p>
      </div>
      <Card className="rounded-lg border-border/70 shadow-none">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3">
          <Banknote className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">잠시만 기다려주세요</p>
        </CardContent>
      </Card>
    </div>
  );
}
