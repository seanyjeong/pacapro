import apiClient from './client';
import { PACA_API_BASE_URL } from './base-url';
import type { AdmissionApplication, AdmissionPreview, AdmissionProfile, AdmissionTerms } from '@/lib/types/ilsan-admission';

export async function submitAdmission(profile: AdmissionProfile, key: string): Promise<{receipt:string;message:string}> {
  let response:Response;
  try {
    response = await fetch(`${PACA_API_BASE_URL}/ilsan-admissions/submit`, {method:'POST',
      headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(profile),signal:AbortSignal.timeout(15000)});
  } catch { throw new Error('연결이 원활하지 않습니다. 입력한 내용을 유지한 채 다시 제출해 주세요.'); }
  const result = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : '원서를 접수하지 못했습니다. 다시 시도해 주세요.');
  if(typeof result.receipt!=='string') throw new Error('접수 결과를 확인하지 못했습니다. 다시 제출해 주세요.');
  return result;
}
export const admissionsAPI = {
  list: (before?:number) => apiClient.get<{applications:AdmissionApplication[];next_cursor:number|null}>(`/ilsan-admissions${before ? `?before=${before}` : ''}`),
  preview: (id:number, terms:AdmissionTerms) => apiClient.post<AdmissionPreview>(`/ilsan-admissions/${id}/preview`,terms,{suppressErrorToast:true}),
  confirm: (id:number, terms:AdmissionTerms, hash:string) => apiClient.post<AdmissionApplication>(`/ilsan-admissions/${id}/confirm`,{...terms,preview_hash:hash},{suppressErrorToast:true}),
  cancel: (id:number, revision:number) => apiClient.post<AdmissionApplication>(`/ilsan-admissions/${id}/cancel`,{revision},{suppressErrorToast:true}),
};
export function admissionError(error: unknown): string {
  const candidate = error as {response?:{data?:{message?:unknown}};message?:unknown};
  const message = candidate?.response?.data?.message;
  return typeof message === 'string' ? message : '처리하지 못했습니다. 내용을 확인하고 다시 시도해 주세요.';
}
