import { ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SalaryDetailWithRates } from './salary-detail-types';

interface SalaryDetailFooterProps {
  salary: SalaryDetailWithRates;
  paying: boolean;
  recalculating: boolean;
  onBack: () => void;
  onPay: () => void;
  onRecalculate: () => void;
}

export function SalaryDetailFooter({ salary, paying, recalculating, onBack, onPay, onRecalculate }: SalaryDetailFooterProps) {
  return (
    <div className="flex flex-col gap-2 pt-1 no-print sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">
        <ArrowLeft className="h-4 w-4" />
        목록
      </Button>
      {salary.payment_status === 'pending' ? (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={onRecalculate} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            재계산
          </Button>
          <Button type="button" onClick={onPay} disabled={paying}>
            <CheckCircle className="h-4 w-4" />
            {paying ? '처리 중' : '지급 완료'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
