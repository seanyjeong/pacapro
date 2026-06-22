import Link from 'next/link';
import { ArrowLeft, CreditCard, ListFilter } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getStudentPaymentTitle } from './tablet-payments-utils';

interface TabletPaymentsHeaderProps {
  studentId?: number;
  studentName: string | null;
  selectedYearMonth: string;
  visibleCount: number;
}

export function TabletPaymentsHeader({
  studentId,
  studentName,
  selectedYearMonth,
  visibleCount,
}: TabletPaymentsHeaderProps) {
  const title = getStudentPaymentTitle(studentId, studentName);

  return (
    <header className="flex flex-col gap-3 rounded-md border border-border bg-background px-4 py-4 shadow-none lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>{formatHeaderMonth(selectedYearMonth)}</span>
          <span aria-hidden="true">/</span>
          <span>{visibleCount}건</span>
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {studentId ? (
          <>
            <Link href={`/tablet/students/${studentId}`} className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
              <ArrowLeft className="h-4 w-4" />
              학생 상세
            </Link>
            <Link href="/tablet/payments" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
              <ListFilter className="h-4 w-4" />
              전체 결제
            </Link>
          </>
        ) : null}
      </div>
    </header>
  );
}

function formatHeaderMonth(value: string): string {
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return `${year}년 ${Number(month)}월`;
}
