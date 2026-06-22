import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { CreditFilters } from './credits-types';
import type { CreditsResponse, CreditsSummaryResponse } from '@/lib/types/payment';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export function getCreditsForPage(filters: CreditFilters): Promise<CreditsResponse> {
  return apiClient.get<CreditsResponse>('/payments/credits', {
    ...SILENT_CONFIG,
    params: createCreditsParams(filters),
  });
}

export function getCreditsSummaryForPage(): Promise<CreditsSummaryResponse> {
  return apiClient.get<CreditsSummaryResponse>('/payments/credits/summary', SILENT_CONFIG);
}

function createCreditsParams(filters: CreditFilters) {
  const params: Record<string, string> = {};
  if (filters.status !== 'all') params.status = filters.status;
  if (filters.type !== 'all') params.credit_type = filters.type;
  return params;
}
