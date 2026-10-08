import type { LifecycleCreditType } from '@/lib/types/lifecycle-billing';

export const LIFECYCLE_CREDIT_CHOICES: { value: LifecycleCreditType; label: string; detail: string }[] = [
  { value: 'none', label: '크레딧 생성 안 함', detail: '미납 월 학원비 정산은 적용됩니다.' },
  { value: 'carryover', label: '크레딧 이월', detail: '다음 달 수업료 차감을 위해 대기로 등록합니다.' },
  { value: 'refund', label: '환불 크레딧', detail: '환불 대기로 등록하고 실제 환불은 별도로 확인합니다.' },
];

export const LIFECYCLE_CREDIT_STATUS_LABELS: Record<string, string> = {
  pending: '대기', approved: '승인', partial: '일부 사용', applied: '적용 완료',
  used: '사용 완료', refunded: '환불 완료', cancelled: '취소',
};
