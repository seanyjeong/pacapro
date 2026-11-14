import { Moon, Sun, Sunrise } from 'lucide-react';
import type { Tone } from '@/components/ui/page';
import type { TimeSlot } from '@/lib/types/schedule';

/** 수업 화면 전체에서 같은 시간대 아이콘·색을 쓰기 위한 표. */
export const TIME_SLOT_META: Array<{ slot: TimeSlot; label: string; icon: typeof Sun; tone: Tone }> = [
  { slot: 'morning', label: '오전', icon: Sunrise, tone: 'warning' },
  { slot: 'afternoon', label: '오후', icon: Sun, tone: 'primary' },
  { slot: 'evening', label: '저녁', icon: Moon, tone: 'neutral' },
];

export const TIME_SLOT_BADGE: Record<TimeSlot, 'warning' | 'default' | 'secondary'> = {
  morning: 'warning',
  afternoon: 'default',
  evening: 'secondary',
};
