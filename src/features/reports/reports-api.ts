import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { hasReceivedPayment } from '@/lib/utils/payment-helpers';
import { canView } from '@/lib/utils/permissions';
import type {
  ExpensesReportResponse,
  IncomesReportResponse,
  InstructorsReportResponse,
  PaymentsReportResponse,
  ReportAccess,
  ReportSourceData,
  StudentsReportResponse,
} from './reports-types';
import { getReportDateRange } from './reports-utils';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export function getReportAccess(): ReportAccess {
  return {
    payments: canView('payments'),
    expenses: canView('expenses'),
    instructors: canView('instructors'),
    incomes: canView('incomes'),
  };
}

export async function fetchReportSourceData(selectedMonth: string, access: ReportAccess): Promise<ReportSourceData> {
  const range = getReportDateRange(selectedMonth);
  const [students, payments, paidPayments, expenses, instructors, incomes] = await Promise.all([
    apiClient.get<StudentsReportResponse>('/students', QUIET_REQUEST),
    access.payments
      ? apiClient.get<PaymentsReportResponse>(`/payments?year=${range.year}&month=${range.month}`, QUIET_REQUEST)
      : ({} as PaymentsReportResponse),
    access.payments
      ? apiClient.get<PaymentsReportResponse>(
        `/payments?paid_year=${range.year}&paid_month=${range.month}`,
        QUIET_REQUEST
      )
      : ({} as PaymentsReportResponse),
    access.expenses
      ? apiClient.get<ExpensesReportResponse>(
        `/expenses?start_date=${range.startDate}&end_date=${range.endDate}`,
        QUIET_REQUEST
      )
      : ({} as ExpensesReportResponse),
    access.instructors
      ? apiClient.get<InstructorsReportResponse>('/instructors', QUIET_REQUEST)
      : ({} as InstructorsReportResponse),
    access.incomes
      ? apiClient.get<IncomesReportResponse>(
        `/incomes?start_date=${range.startDate}&end_date=${range.endDate}`,
        QUIET_REQUEST
      )
      : ({} as IncomesReportResponse),
  ]);

  return {
    students: students.students ?? [],
    payments: payments.payments ?? [],
    // 그 달에 받은 돈: 완납 + 부분 납부(대시보드·수입 화면과 같은 규칙)
    paidPayments: (paidPayments.payments ?? []).filter(hasReceivedPayment),
    expenses: expenses.expenses ?? [],
    instructors: instructors.instructors ?? [],
    otherIncomes: incomes.incomes ?? [],
  };
}
