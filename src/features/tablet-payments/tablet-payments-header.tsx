import Link from 'next/link';
import { ArrowLeft, ListFilter, RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { getStudentPaymentTitle } from './tablet-payments-utils';

interface TabletPaymentsHeaderProps {
  studentId?: number;
  studentName: string | null;
  visibleCount: number;
  onReload: () => void;
}

export function TabletPaymentsHeader({
  studentId,
  studentName,
  visibleCount,
  onReload,
}: TabletPaymentsHeaderProps) {
  const title = getStudentPaymentTitle(studentId, studentName);

  return (
    <PageHeader
      title={title}
      description={`${visibleCount}건 표시 중`}
      actions={(
        <>
          {studentId ? (
            <>
              <Link href={`/tablet/students/${studentId}`} className={buttonVariants({ variant: 'outline' })}>
                <ArrowLeft className="h-4 w-4" />
                학생 상세
              </Link>
              <Link href="/tablet/payments" className={buttonVariants({ variant: 'outline' })}>
                <ListFilter className="h-4 w-4" />
                전체 결제
              </Link>
            </>
          ) : null}
          <Button variant="outline" onClick={onReload}>
            <RotateCcw className="h-4 w-4" />
            새로고침
          </Button>
        </>
      )}
    />
  );
}
