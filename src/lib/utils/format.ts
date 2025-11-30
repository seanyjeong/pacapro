import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 금액을 천원 단위로 절삭 (백원 단위 버림)
 * 예: 152,300 → 152,000
 */
export function truncateToThousands(amount: number): number {
    return Math.floor(amount / 1000) * 1000;
}

/**
 * 금액을 한국 원화 형식으로 포맷 (정수만, 소수점 없음)
 */
export function formatCurrency(amount: number): string {
    const intAmount = Math.floor(amount);
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }).format(intAmount);
}

/**
 * 숫자를 3자리마다 콤마로 구분 (정수만)
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('ko-KR', {
        maximumFractionDigits: 0,
    }).format(Math.floor(num));
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy-MM-dd');
}

/**
 * 날짜를 한국어 형식으로 포맷 (2025년 11월 24일)
 */
export function formatKoreanDate(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy년 M월 d일', { locale: ko });
}

/**
 * 날짜와 시간을 포맷
 */
export function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy-MM-dd HH:mm');
}

/**
 * 전화번호를 010-XXXX-XXXX 형식으로 포맷
 */
export function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}

/**
 * 수업 요일 배열을 한글로 변환 [1,3,5] -> "월, 수, 금"
 */
export function formatClassDays(days: number[]): string {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return days.map((day) => dayNames[day]).join(', ');
}

/**
 * 퍼센트 포맷
 */
export function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

/**
 * 출석률 계산 및 포맷
 */
export function formatAttendanceRate(present: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((present / total) * 100)}%`;
}
