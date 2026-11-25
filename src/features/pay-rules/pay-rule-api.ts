import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { PayRule, PayRulePayload } from './pay-rule-types';

const QUIET: APIRequestConfig = { suppressErrorToast: true };

export async function fetchPayRules(query: { instructorId?: number; seasonId?: number }): Promise<PayRule[]> {
  const params = new URLSearchParams();
  if (query.instructorId) params.append('instructor_id', String(query.instructorId));
  if (query.seasonId) params.append('season_id', String(query.seasonId));
  const response = await apiClient.get<{ rules: PayRule[] }>(`/pay-rules?${params}`, QUIET);
  return response.rules ?? [];
}

export function createPayRule(instructorId: number, payload: PayRulePayload): Promise<unknown> {
  return apiClient.post('/pay-rules', { ...payload, instructor_id: instructorId }, QUIET);
}

export function updatePayRule(ruleId: number, payload: PayRulePayload): Promise<unknown> {
  return apiClient.put(`/pay-rules/${ruleId}`, payload, QUIET);
}

export function deletePayRule(ruleId: number): Promise<unknown> {
  return apiClient.delete(`/pay-rules/${ruleId}`, QUIET);
}

export function createSeasonPayRules(seasonId: number, instructorIds: number[], payload: PayRulePayload): Promise<unknown> {
  return apiClient.post(`/pay-rules/season/${seasonId}`, { ...payload, instructor_ids: instructorIds }, QUIET);
}

export function syncSeasonPayRules(seasonId: number, ruleIds: number[]): Promise<unknown> {
  return apiClient.post(`/pay-rules/season/${seasonId}/sync`, { rule_ids: ruleIds }, QUIET);
}
