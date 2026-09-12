import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { APIRequestConfig } from '@/lib/api/client';
import { localDateKey, moveMonth } from './mobile-calendar-utils';

export function useMobileMonth<T>(loader: (month: string, config: APIRequestConfig) => Promise<T>) {
  const router = useRouter();
  const [today] = useState(() => localDateKey(new Date()));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ month: string; data: T | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/login');
      return;
    }
    let active = true;
    setResult(null);
    loader(month, { suppressErrorToast: true }).then(
      data => { if (active) setResult({ month, data, error: false }); },
      () => { if (active) setResult({ month, data: null, error: true }); },
    );
    // 월을 빠르게 넘길 때 이전 요청이 새 달의 결과를 덮어쓰지 않게 한다.
    return () => { active = false; };
  }, [loader, month, retry, router]);

  const selectMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setSelectedDate(nextMonth === today.slice(0, 7) ? today : `${nextMonth}-01`);
  };
  const current = result?.month === month ? result : null;
  return {
    month, today, selectedDate, setSelectedDate,
    data: current?.data ?? null,
    loading: !current,
    error: current?.error ?? false,
    reload: () => setRetry(value => value + 1),
    onMonthMove: (offset: number) => selectMonth(moveMonth(month, offset)),
    onToday: () => selectMonth(today.slice(0, 7)),
  };
}
