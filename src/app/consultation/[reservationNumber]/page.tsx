'use client';

import type { ReactNode } from 'react';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, UserRound } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PACA_API_BASE_URL } from '@/lib/api/base-url';
import { cn } from '@/lib/utils/cn';

const API_URL = PACA_API_BASE_URL;

interface ReservationInfo {
  academyName: string;
  academySlug: string;
  id: number;
  preferredDate: string;
  preferredTime: string;
  reservationNumber: string;
  status: string;
  studentGrade: string;
  studentName: string;
}

interface TimeSlot {
  available: boolean;
  reason: string | null;
  time: string;
}

export default function ReservationChangePage({
  params,
}: {
  params: Promise<{ reservationNumber: string }>;
}) {
  const { reservationNumber } = use(params);

  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const availableDates = useMemo(createAvailableDates, []);

  useEffect(() => {
    let cancelled = false;

    const fetchReservation = async () => {
      try {
        const response = await fetch(`${API_URL}/public/reservation/${reservationNumber}`);
        if (!response.ok) {
          if (!cancelled) setError('예약 정보를 불러오지 못했습니다. 예약번호를 확인한 뒤 다시 시도해주세요.');
          return;
        }

        const data = await response.json();
        if (cancelled) return;
        setReservation(data);
        setSelectedDate(formatInputDate(data.preferredDate));
        setSelectedTime(data.preferredTime);
      } catch {
        if (!cancelled) setError('예약 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchReservation();
    return () => {
      cancelled = true;
    };
  }, [reservationNumber]);

  useEffect(() => {
    if (!selectedDate || !reservation) return;
    let cancelled = false;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSlotsError(null);
      try {
        const response = await fetch(`${API_URL}/public/consultation/${reservation.academySlug}/slots?date=${selectedDate}`);
        if (!response.ok) {
          if (!cancelled) {
            setAvailableSlots([]);
            setSlotsError('시간대를 불러오지 못했습니다. 잠시 후 다시 선택해주세요.');
          }
          return;
        }

        const data = await response.json();
        if (!cancelled) setAvailableSlots(data.slots || []);
      } catch {
        if (!cancelled) {
          setAvailableSlots([]);
          setSlotsError('시간대를 불러오지 못했습니다. 잠시 후 다시 선택해주세요.');
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    void fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, reservation]);

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!selectedDate || !selectedTime) {
      setSubmitError('날짜와 시간을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/public/reservation/${reservationNumber}`, {
        body: JSON.stringify({ preferredDate: selectedDate, preferredTime: selectedTime }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });

      if (!response.ok) {
        setSubmitError('예약을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      setSuccess(true);
    } catch {
      setSubmitError('예약을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (success && reservation) return <SuccessState reservation={reservation} selectedDate={selectedDate} selectedTime={selectedTime} />;

  return (
    <section className="space-y-4 text-slate-950" data-testid="reservation-change-workspace">
      <HeaderCard academyName={reservation?.academyName} />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold tracking-normal text-slate-950">현재 예약 정보</h2>
        </div>
        <div className="space-y-3 px-5 py-5 text-sm">
          <InfoRow label="예약번호" value={reservation?.reservationNumber || '-'} />
          <InfoRow label="학생" value={`${reservation?.studentName || '-'} (${reservation?.studentGrade || '-'})`} icon={<UserRound className="h-4 w-4" />} />
          <InfoRow label="현재 일정" value={reservation ? `${formatDisplayDate(reservation.preferredDate)} ${formatDisplayTime(reservation.preferredTime)}` : '-'} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">상태</span>
            <span className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
              reservation?.status === 'confirmed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            )}>
              {reservation?.status === 'confirmed' ? '확정' : '대기중'}
            </span>
          </div>
        </div>
      </section>

      <SelectionCard icon={<Calendar className="h-4 w-4" />} title="새로운 날짜 선택">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {availableDates.map((date) => (
            <button
              key={date}
              type="button"
              aria-pressed={selectedDate === date}
              onClick={() => {
                setSelectedDate(date);
                setSelectedTime('');
              }}
              className={selectableClass(selectedDate === date)}
            >
              {formatDisplayDate(date)}
            </button>
          ))}
        </div>
      </SelectionCard>

      <SelectionCard icon={<Clock className="h-4 w-4" />} title="새로운 시간 선택">
        {loadingSlots ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            가능한 시간을 확인하고 있습니다.
          </div>
        ) : slotsError ? (
          <SafeAlert tone="warning" message={slotsError} />
        ) : availableSlots.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            {selectedDate ? '선택한 날짜에 가능한 시간이 없습니다.' : '날짜를 먼저 선택해주세요.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {availableSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                aria-pressed={selectedTime === slot.time}
                onClick={() => slot.available && setSelectedTime(slot.time)}
                className={selectableClass(selectedTime === slot.time, !slot.available)}
              >
                {formatDisplayTime(slot.time)}
              </button>
            ))}
          </div>
        )}
      </SelectionCard>

      {submitError ? <SafeAlert tone="danger" message={submitError} /> : null}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !selectedDate || !selectedTime}
        className="h-12 w-full"
      >
        {submitting ? '변경 중...' : '예약 변경하기'}
      </Button>
      <p className="px-2 text-center text-sm leading-6 text-slate-500">
        예약 변경 후 담당자 확인을 거쳐 다시 확정 안내를 받게 됩니다.
      </p>
    </section>
  );
}

function HeaderCard({ academyName }: { academyName?: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">예약 변경 데스크</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">상담 예약 변경</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {academyName || '담당 학원'} 상담 일정을 다시 선택할 수 있습니다. 변경 후 담당자가 한 번 더 확인합니다.
      </p>
    </section>
  );
}

function SelectionCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">{icon}</span>
        <h2 className="text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function InfoRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-500">
        {icon}
        {label}
      </span>
      <span className="min-w-0 text-right font-medium text-slate-950">{value}</span>
    </div>
  );
}

function SafeAlert({ message, tone }: { message: string; tone: 'danger' | 'warning' }) {
  const classes = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-md border p-4 text-sm leading-6', classes)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
      <p className="mt-3 text-sm text-slate-600">예약 정보를 확인하고 있습니다.</p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
      <h1 className="mt-4 text-xl font-semibold tracking-normal text-slate-950">예약 조회 실패</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <Link href="/" className={buttonVariants({ variant: 'outline', className: 'mt-5 w-full gap-2' })}>
        <ArrowLeft className="h-4 w-4" />
        홈으로 돌아가기
      </Link>
    </section>
  );
}

function SuccessState({
  reservation,
  selectedDate,
  selectedTime,
}: {
  reservation: ReservationInfo;
  selectedDate: string;
  selectedTime: string;
}) {
  return (
    <section className="space-y-4 text-slate-950">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">예약 변경 완료</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">예약이 변경되었습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          담당자 확인 후 다시 확정 안내를 받으실 수 있습니다.
        </p>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-medium text-slate-500">{reservation.academyName}</p>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">새로운 일정</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {formatDisplayDate(selectedDate)} {formatDisplayTime(selectedTime)}
          </div>
          <Link href={`/c/${reservation.academySlug}`} className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            예약 페이지로 돌아가기
          </Link>
        </div>
      </section>
    </section>
  );
}

function createAvailableDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return formatLocalInputDate(date);
  });
}

function formatInputDate(dateStr: string) {
  return dateStr.split('T')[0];
}

function formatLocalInputDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`;
}

function formatDisplayTime(time: string) {
  return time.slice(0, 5);
}

function selectableClass(selected: boolean, disabled = false) {
  return cn(
    'min-h-10 rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
    selected && 'border-blue-600 bg-blue-600 text-white',
    !selected && !disabled && 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    disabled && 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 line-through'
  );
}
