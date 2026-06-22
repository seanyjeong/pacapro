export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const REASON_PRESETS = [
  { value: '시험기간', label: '시험기간' },
  { value: '경조사', label: '경조사' },
  { value: '병결', label: '병결' },
  { value: '기타', label: '기타' },
] as const;

export const CREDIT_TYPE_LABELS: Record<string, string> = {
  carryover: '이월',
  excused: '공결',
  manual: '수동',
  refund: '환불',
};

export const CREDIT_STATUS_LABELS: Record<string, string> = {
  pending: '미사용',
  partial: '부분사용',
  applied: '크레딧사용',
  used: '사용됨',
  refunded: '환불완료',
  cancelled: '취소',
  expired: '만료',
};

export function countClassDaysInPeriod(startDate: string, endDate: string, classDays: number[]) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const classDates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (classDays.includes(dayOfWeek)) {
      const month = current.getMonth() + 1;
      const day = current.getDate();
      const dayName = DAY_NAMES[dayOfWeek];
      classDates.push(`${month}/${day}(${dayName})`);
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    count: classDates.length,
    dates: classDates,
  };
}

export function getCreditStatusClass(status: string) {
  if (status === 'pending') {
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  }

  if (status === 'used' || status === 'applied') {
    return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  }

  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }

  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message;
  if (typeof message !== 'string' || !message.trim()) return fallback;

  const technicalMessagePattern = /(CORS|Axios|stack trace|HTTP\s*(400|401|403|404|500)|status\s*(400|401|403|404|500))/i;
  return technicalMessagePattern.test(message) ? fallback : message;
}
