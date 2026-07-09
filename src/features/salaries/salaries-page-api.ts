import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import type { Instructor } from '@/lib/types/instructor';
import type { SalariesResponse, SalaryDetailResponse, SalaryFilters } from '@/lib/types/salary';
import type { SalarySettings } from './salaries-page-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function getSalaryPageSettings(): Promise<SalarySettings> {
  const response = await apiClient.get<{ settings?: SalarySettings }>('/settings/academy', SILENT_CONFIG);
  return response.settings || {};
}

export async function getActiveSalaryInstructors(): Promise<Instructor[]> {
  const response = await apiClient.get<{ instructors?: Instructor[] }>('/instructors', {
    ...SILENT_CONFIG,
    params: { status: 'active' },
  });
  return response.instructors || [];
}

export async function getSalariesForPage(filters: SalaryFilters): Promise<SalariesResponse> {
  return apiClient.get<SalariesResponse>('/salaries', {
    ...SILENT_CONFIG,
    params: createSalaryParams(filters),
  });
}

export function getSalaryDetailForPage(id: number): Promise<SalaryDetailResponse> {
  return apiClient.get<SalaryDetailResponse>(`/salaries/${id}`, SILENT_CONFIG);
}

export function bulkPaySalaries(params: {
  year_month?: string;
  salary_ids?: number[];
  payment_date?: string;
}): Promise<{ message: string; paid_count: number }> {
  return apiClient.post('/salaries/bulk-pay', params, SILENT_CONFIG);
}

export function downloadSalariesExcel(filters: SalaryFilters) {
  return exportsApi.downloadSalaries({
    year: filters.year,
    month: filters.month,
    payment_status: filters.payment_status,
  });
}

function createSalaryParams(filters: SalaryFilters) {
  const params: Record<string, string | number> = {};
  if (filters.instructor_id) params.instructor_id = filters.instructor_id;
  if (filters.year) params.year = filters.year;
  if (filters.month) params.month = filters.month;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  return params;
}
