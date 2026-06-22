import type { StudentDetail, StudentPayment } from '@/lib/types/student';
import { formatClassDays } from '@/lib/utils/student-helpers';
import type { StudentDetailTabItem } from './student-detail-types';

export function buildStudentTabs(student: StudentDetail, paymentCount: number): StudentDetailTabItem[] {
  const tabs: StudentDetailTabItem[] = [
    { id: 'performance', label: '성적 기록' },
    { id: 'attendance', label: '출결 현황' },
    { id: 'payments', label: '납부 내역', count: paymentCount > 0 ? paymentCount : undefined },
  ];

  if (student.student_type === 'exam') {
    tabs.push({ id: 'seasons', label: '시즌 등록' });
  }

  tabs.push({ id: 'consultations', label: '상담 기록' });
  return tabs;
}

export function getOutstandingAmount(payments: StudentPayment[]) {
  return payments
    .filter((payment) => payment.payment_status !== 'paid')
    .reduce((sum, payment) => {
      const finalAmount = Number.parseInt(payment.final_amount, 10) || 0;
      const paidAmount = Number.parseInt(payment.paid_amount || '0', 10) || 0;
      return sum + Math.max(finalAmount - paidAmount, 0);
    }, 0);
}

export function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function getClassSummary(student: StudentDetail) {
  const days = formatClassDays(student.class_days);
  return days ? `${days} / 주 ${student.weekly_count}회` : `주 ${student.weekly_count}회`;
}
