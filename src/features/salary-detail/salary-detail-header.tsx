import type { ReactNode } from 'react';
import { ArrowLeft, CheckCircle, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
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

export function SalaryDetailTitleBar({ onBack, description, actions }: {
  onBack: () => void;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1 no-print">
      <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기" className="-ml-2 mt-1.5 shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <PageHeader className="min-w-0 flex-1" title="급여 명세서" description={description} actions={actions} />
    </div>
  );
}

export function SalaryDetailHeader({ salary, paying, recalculating, onBack, onPrint, onPay, onRecalculate }: SalaryDetailHeaderProps) {
  return (
    <SalaryDetailTitleBar
      onBack={onBack}
      description={`${salary.instructor_name} · ${salary.year_month}`}
      actions={(
        <>
          <Button type="button" variant="outline" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            인쇄
          </Button>
          {salary.payment_status === 'pending' ? (
            <>
              <Button type="button" variant="outline" onClick={onRecalculate} disabled={recalculating}>
                <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                재계산
              </Button>
              <Button type="button" onClick={onPay} disabled={paying}>
                <CheckCircle className="h-4 w-4" />
                {paying ? '처리 중' : '지급 완료'}
              </Button>
            </>
          ) : null}
        </>
      )}
    />
  );
}
