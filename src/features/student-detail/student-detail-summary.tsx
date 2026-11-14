import { StatTile } from '@/components/ui/page';
import type { StudentDetail, StudentPayment } from '@/lib/types/student';
import { formatClassDays, formatCurrency, getEffectiveMonthlyTuition } from '@/lib/utils/student-helpers';
import { getOutstandingAmount, formatWon } from './student-detail-utils';

interface StudentDetailSummaryProps {
  payments: StudentPayment[];
  student: StudentDetail;
  unpaidPaymentCount: number;
  onOpenPayments: () => void;
}

// 수업·학원비·미납 요약. 학생 정보 카드에는 같은 숫자를 다시 쓰지 않는다.
export function StudentDetailSummary({ payments, student, unpaidPaymentCount, onOpenPayments }: StudentDetailSummaryProps) {
  const outstanding = getOutstandingAmount(payments);
  const effectiveTuition = getEffectiveMonthlyTuition(student);
  const discountRate = Number.parseFloat(student.discount_rate) || 0;
  const days = formatClassDays(student.class_days);
  const nextDays = student.class_days_next && student.class_days_effective_from
    ? `변경 예정: ${formatClassDays(student.class_days_next)} (${student.class_days_effective_from.slice(0, 7)}부터)`
    : null;
  const tuitionNote = [
    discountRate > 0 ? `${formatCurrency(student.monthly_tuition)}에서 ${discountRate}% 할인` : `월 학원비 ${formatCurrency(student.monthly_tuition)}`,
    student.payment_due_day ? `매월 ${student.payment_due_day}일 납부` : '학원 기본 납부일',
  ].join(' · ');

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <StatTile
        className="col-span-2 lg:col-span-1"
        label="수업"
        value={`주 ${student.weekly_count}회`}
        note={[days || '요일 없음', nextDays].filter(Boolean).join(' · ')}
      />
      <StatTile label="실납부" value={formatWon(effectiveTuition)} note={tuitionNote} />
      <StatTile
        label="미납"
        value={formatWon(outstanding)}
        tone={outstanding > 0 ? 'warning' : 'neutral'}
        note={outstanding > 0 ? `${unpaidPaymentCount}건 · 납부 내역 보기` : '확인할 미납이 없어요'}
        onClick={onOpenPayments}
      />
    </div>
  );
}
