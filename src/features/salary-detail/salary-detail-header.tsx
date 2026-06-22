import { ArrowLeft, CheckCircle, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SalaryDetailWithRates } from './salary-detail-types';

interface SalaryDetailHeaderProps {
  salary: SalaryDetailWithRates;
  paying: boolean;
  recalculating: boolean;
  onBack: () => void;
  onPrint: () => void;
  onPay: () => void;
  onRecalculate: () => void;
}

export function SalaryDetailHeader({ salary, paying, recalculating, onBack, onPrint, onPay, onRecalculate }: SalaryDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 no-print md:flex-row md:items-end md:justify-between">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">급여 명세서</h1>
          <p className="mt-1 text-sm text-muted-foreground">{salary.year_month}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          인쇄
        </Button>
        {salary.payment_status === 'pending' ? (
          <>
            <Button type="button" variant="outline" onClick={onRecalculate} disabled={recalculating}>
              <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              재계산
            </Button>
            <Button type="button" onClick={onPay} disabled={paying}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {paying ? '처리 중' : '지급 완료'}
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
