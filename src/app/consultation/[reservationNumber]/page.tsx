'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/paca';

interface ReservationInfo {
  id: number;
  reservationNumber: string;
  studentName: string;
  studentGrade: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  academyName: string;
  academySlug: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  reason: string | null;
}

export default function ReservationChangePage({
  params,
}: {
  params: Promise<{ reservationNumber: string }>;
}) {
  const resolvedParams = use(params);
  const { reservationNumber } = resolvedParams;

  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 날짜/시간 변경 상태
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // 예약 정보 조회
  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const response = await fetch(`${API_URL}/public/reservation/${reservationNumber}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || '예약 정보를 찾을 수 없습니다.');
          return;
        }

        setReservation(data);
        setSelectedDate(new Date(data.preferredDate).toISOString().split('T')[0]);
        setSelectedTime(data.preferredTime);
      } catch {
        setError('서버 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [reservationNumber]);

  // 날짜 선택 시 가능한 시간대 조회
  useEffect(() => {
    if (!selectedDate || !reservation) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const response = await fetch(
          `${API_URL}/public/consultation/${reservation.academySlug}/slots?date=${selectedDate}`
        );
        const data = await response.json();

        if (response.ok) {
          setAvailableSlots(data.slots || []);
        }
      } catch {
        console.error('시간대 조회 실패');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, reservation]);

  // 예약 변경 제출
  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      alert('날짜와 시간을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/public/reservation/${reservationNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredDate: selectedDate,
          preferredTime: selectedTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || '예약 변경에 실패했습니다.');
        return;
      }

      setSuccess(true);
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 날짜 배열 생성 (오늘부터 30일)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">예약 조회 실패</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">예약이 변경되었습니다</h1>
          <p className="text-gray-600 mb-2">
            관리자 확인 후 다시 확정 알림을 받으실 수 있습니다.
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mt-4">
            <p className="text-sm text-gray-600">새로운 일정</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(selectedDate)} {selectedTime}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">상담 예약 변경</h1>
          <p className="text-gray-600 text-sm">{reservation?.academyName}</p>
        </div>

        {/* 현재 예약 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">현재 예약 정보</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">예약번호</span>
              <span className="font-medium text-gray-900">{reservation?.reservationNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">학생명</span>
              <span className="font-medium text-gray-900">{reservation?.studentGrade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">현재 일정</span>
              <span className="font-medium text-gray-900">
                {reservation && formatDate(reservation.preferredDate)} {reservation?.preferredTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">상태</span>
              <span className={`font-medium ${
                reservation?.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {reservation?.status === 'confirmed' ? '확정' : '대기중'}
              </span>
            </div>
          </div>
        </div>

        {/* 날짜 선택 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">새로운 날짜 선택</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {getAvailableDates().map((date) => (
              <button
                key={date}
                onClick={() => {
                  setSelectedDate(date);
                  setSelectedTime('');
                }}
                className={`py-2 px-3 text-sm rounded-lg transition-colors ${
                  selectedDate === date
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        </div>

        {/* 시간 선택 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">새로운 시간 선택</h2>
          </div>

          {loadingSlots ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              {selectedDate ? '선택하신 날짜에 가능한 시간이 없습니다.' : '날짜를 먼저 선택해주세요.'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && setSelectedTime(slot.time)}
                  disabled={!slot.available}
                  className={`py-2 px-3 text-sm rounded-lg transition-colors ${
                    selectedTime === slot.time
                      ? 'bg-blue-600 text-white'
                      : slot.available
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 변경 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedDate || !selectedTime}
          className={`w-full py-4 rounded-xl text-lg font-semibold transition-colors ${
            submitting || !selectedDate || !selectedTime
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {submitting ? '변경 중...' : '예약 변경하기'}
        </button>

        <p className="text-sm text-gray-500 text-center mt-4">
          예약 변경 시 관리자 확인 후 다시 확정 알림이 발송됩니다.
        </p>
      </div>
    </div>
  );
}
