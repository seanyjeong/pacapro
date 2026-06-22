import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentPageErrorProps {
  viewOnly: boolean;
  message: string;
  onRetry: () => void;
}

export function PaymentPageError({ viewOnly, message, onRetry }: PaymentPageErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="border-b border-border/70 pb-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
          {viewOnly ? '미납 학원비' : '학원비 관리'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewOnly ? '미납 학원비 현황 조회' : '청구, 수납, 크레딧, 미납 알림'}
        </p>
      </div>
      <Card className="rounded-md border-border shadow-none">
        <CardContent className="px-5 py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-semibold text-foreground">학원비 정보를 불러오지 못했습니다</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button type="button" onClick={onRetry} className="mt-5">
            다시 시도
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
