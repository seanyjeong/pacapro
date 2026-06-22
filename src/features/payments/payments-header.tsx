import { Bell, Calculator, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface PaymentsHeaderProps {
  viewOnly: boolean;
  canEdit: boolean;
  sendingNotification: boolean;
  unpaidCount: number;
  onOpenCalculator: () => void;
  onReload: () => void;
  onSendUnpaid: () => void;
  onAddPayment: () => void;
}

export function PaymentsHeader({
  viewOnly,
  canEdit,
  sendingNotification,
  unpaidCount,
  onOpenCalculator,
  onReload,
  onSendUnpaid,
  onAddPayment,
}: PaymentsHeaderProps) {
  return (
    <header className="space-y-4 border-b border-border/70 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
            {viewOnly ? '미납 학원비' : '학원비 관리'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewOnly ? '미납 학원비 현황 조회' : '청구, 수납, 크레딧, 미납 알림'}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onOpenCalculator} className="w-full sm:w-auto">
            <Calculator className="mr-2 h-4 w-4" />
            일할계산기
          </Button>
          <Button type="button" variant="outline" onClick={onReload} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onSendUnpaid}
                disabled={sendingNotification || unpaidCount === 0}
                className="w-full sm:w-auto"
              >
                <Bell className={cn('mr-2 h-4 w-4', sendingNotification && 'animate-pulse')} />
                {sendingNotification ? '발송 중...' : `미납 알림 (${unpaidCount}명)`}
              </Button>
              <Button type="button" onClick={onAddPayment} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                학원비 청구
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
