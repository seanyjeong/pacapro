import { Bell, Calculator, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';

interface PaymentsHeaderProps {
  viewOnly: boolean;
  canEdit: boolean;
  sendingNotification: boolean;
  unpaidCount: number;
  selectedYearMonth: string;
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
  selectedYearMonth,
  onOpenCalculator,
  onReload,
  onSendUnpaid,
  onAddPayment,
}: PaymentsHeaderProps) {
  return (
    <PageHeader
      title={viewOnly ? '미납 학원비' : '학원비 관리'}
      description={`${selectedYearMonth} · ${viewOnly ? '미납 학원비 현황 조회' : '청구, 수납, 크레딧, 미납 알림'}`}
      actions={(
        <>
          <Button type="button" variant="outline" onClick={onOpenCalculator}>
            <Calculator className="h-4 w-4" />
            일할계산
          </Button>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={onSendUnpaid}
                disabled={sendingNotification || unpaidCount === 0}
              >
                <Bell className={cn('h-4 w-4', sendingNotification && 'animate-pulse')} />
                {sendingNotification ? '발송 중...' : `미납 알림 (${unpaidCount}명)`}
              </Button>
              <Button type="button" onClick={onAddPayment}>
                <Plus className="h-4 w-4" />
                학원비 청구
              </Button>
            </>
          ) : null}
          <Button type="button" variant="outline" size="icon" onClick={onReload} aria-label="새로고침" title="새로고침">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </>
      )}
    />
  );
}
