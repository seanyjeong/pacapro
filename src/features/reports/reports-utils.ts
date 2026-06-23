import type { ReportComputedStats, ReportDateRange, ReportExportType, ReportSourceData, ReportStats } from './reports-types';

export const REPORT_LOAD_ERROR = '리포트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const REPORT_EXPORT_ERROR = '엑셀 파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.';

const EMPTY_STATS: ReportStats = {
  students: { total: 0, active: 0, paused: 0, avgMonthlyTuition: 0 },
  payments: { total: 0, paid: 0, unpaid: 0, totalAmount: 0, paidAmountFromBilled: 0, paidAmount: 0 },
  expenses: { total: 0, totalAmount: 0 },
  instructors: { total: 0, active: 0 },
  otherIncomes: { total: 0, totalAmount: 0 },
};

export function getCurrentYearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftReportMonth(selectedMonth: string, offset: number): string {
  const [yearText, monthText] = selectedMonth.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1 + offset;
  return getCurrentYearMonth(new Date(year, monthIndex, 1));
}

export function getReportDateRange(selectedMonth: string): ReportDateRange {
  const [yearText, monthText] = selectedMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    year,
    month,
    startDate: `${selectedMonth}-01`,
    endDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatReportAmount(amount: number): string {
  return Math.floor(amount).toLocaleString('ko-KR');
}

export function getExportSuccessMessage(type: ReportExportType): string {
  const labels: Record<ReportExportType, string> = {
    revenue: '수입 내역 다운로드가 완료되었습니다.',
    expenses: '지출 내역 다운로드가 완료되었습니다.',
    financial: '재무 리포트 다운로드가 완료되었습니다.',
    payments: '납부 내역 다운로드가 완료되었습니다.',
  };
  return labels[type];
}

export function calculateReportStats(data: ReportSourceData): ReportStats {
  const activeStudents = data.students.filter((student) => student.status === 'active');
  const pausedStudents = data.students.filter((student) => student.status === 'paused');
  const graduatedStudents = data.students.filter((student) => student.status === 'graduated');
  const activeStudentIds = new Set(activeStudents.map((student) => student.id));
  const activePayments = data.payments.filter((payment) => activeStudentIds.has(payment.student_id));
  const activeStudentsWithTuition = activeStudents.filter((student) => toAmount(student.monthly_tuition) > 0);
  const tuitionSum = activeStudentsWithTuition.reduce((sum, student) => sum + toAmount(student.monthly_tuition), 0);
  const avgTuition = activeStudentsWithTuition.length > 0 ? tuitionSum / activeStudentsWithTuition.length : 0;
  const paidAmountFromBilled = activePayments
    .filter((payment) => payment.payment_status === 'paid')
    .reduce((sum, payment) => sum + toAmount(payment.paid_amount || payment.final_amount), 0);

  return {
    students: {
      total: activeStudents.length + pausedStudents.length + graduatedStudents.length,
      active: activeStudents.length,
      paused: pausedStudents.length,
      avgMonthlyTuition: Math.floor(avgTuition),
    },
    payments: {
      total: activePayments.length,
      paid: activePayments.filter((payment) => payment.payment_status === 'paid').length,
      unpaid: activePayments.filter((payment) => payment.payment_status !== 'paid').length,
      totalAmount: Math.floor(activePayments.reduce((sum, payment) => sum + toAmount(payment.final_amount), 0)),
      paidAmountFromBilled: Math.floor(paidAmountFromBilled),
      paidAmount: Math.floor(
        data.paidPayments.reduce((sum, payment) => sum + toAmount(payment.paid_amount || payment.final_amount), 0)
      ),
    },
    expenses: {
      total: data.expenses.length,
      totalAmount: Math.floor(data.expenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0)),
    },
    instructors: {
      total: data.instructors.length,
      active: data.instructors.filter((instructor) => instructor.status === 'active').length,
    },
    otherIncomes: {
      total: data.otherIncomes.length,
      totalAmount: Math.floor(data.otherIncomes.reduce((sum, income) => sum + toAmount(income.amount), 0)),
    },
  };
}

export function calculateComputedStats(stats: ReportStats = EMPTY_STATS): ReportComputedStats {
  const totalIncome = stats.payments.paidAmount + stats.otherIncomes.totalAmount;
  const netProfit = totalIncome - stats.expenses.totalAmount;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';
  const collectionRate = stats.payments.totalAmount > 0
    ? Math.round((stats.payments.paidAmountFromBilled / stats.payments.totalAmount) * 100)
    : 0;

  return {
    totalIncome,
    netProfit,
    profitMargin,
    collectionRate,
    unpaidAmount: Math.max(stats.payments.totalAmount - stats.payments.paidAmountFromBilled, 0),
  };
}

function toAmount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
