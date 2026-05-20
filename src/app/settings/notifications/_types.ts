// Phase 4 #1 — notifications/page.tsx 분리 (ADR-017)
// 기존 type 정의 시그니처 무변경 — 프론트 소비 표면 보존 (ADR-013)

export interface SenderNumber {
  id: number;
  service_type: 'solapi' | 'sens';
  phone: string;
  label: string | null;
  is_default: number;
}

export type ServiceType = 'sens' | 'solapi';
export type TemplateType = 'unpaid' | 'consultation' | 'trial' | 'overdue' | 'reminder' | 'attendance';
