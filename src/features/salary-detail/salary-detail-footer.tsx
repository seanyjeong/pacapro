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
    <div className="flex flex-col gap-2 pt-2 no-print sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록
      </Button>
      {salary.payment_status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRecalculate} disabled={recalculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            재계산
          </Button>
          <Button type="button" onClick={onPay} disabled={paying}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {paying ? '처리 중' : '지급 완료'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
