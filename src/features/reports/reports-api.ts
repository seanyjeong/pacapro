import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type {
  ExpensesReportResponse,
  IncomesReportResponse,
  InstructorsReportResponse,
  PaymentsReportResponse,
  ReportSourceData,
  StudentsReportResponse,
} from './reports-types';
import { getReportDateRange } from './reports-utils';

const QUIET_REQUEST: APIRequestConfig = { suppressErrorToast: true };

export async function fetchReportSourceData(selectedMonth: string): Promise<ReportSourceData> {
  const range = getReportDateRange(selectedMonth);
  const [students, payments, paidPayments, expenses, instructors, incomes] = await Promise.all([
    apiClient.get<StudentsReportResponse>('/students', QUIET_REQUEST),
    apiClient.get<PaymentsReportResponse>(`/payments?year=${range.year}&month=${range.month}`, QUIET_REQUEST),
    apiClient.get<PaymentsReportResponse>(
      `/payments?paid_year=${range.year}&paid_month=${range.month}&payment_status=paid`,
      QUIET_REQUEST
    ),
    apiClient.get<ExpensesReportResponse>(
      `/expenses?start_date=${range.startDate}&end_date=${range.endDate}`,
      QUIET_REQUEST
    ),
    apiClient.get<InstructorsReportResponse>('/instructors', QUIET_REQUEST),
    apiClient.get<IncomesReportResponse>(
      `/incomes?start_date=${range.startDate}&end_date=${range.endDate}`,
      QUIET_REQUEST
    ),
  ]);

  return {
    students: students.students ?? [],
    payments: payments.payments ?? [],
    paidPayments: paidPayments.payments ?? [],
    expenses: expenses.expenses ?? [],
    instructors: instructors.instructors ?? [],
    otherIncomes: incomes.incomes ?? [],
  };
}
