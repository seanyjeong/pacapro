'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit } from '@/lib/utils/permissions';
import { schedulesApi, InstructorAttendanceRecord, InstructorAttendanceSubmission } from '@/lib/api/schedules';
import { ArrowLeft, Check, X, Clock, AlertCircle, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type TimeSlot = 'morning' | 'afternoon' | 'evening';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

const TIME_SLOTS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

const STATUS_BUTTONS: { value: AttendanceStatus; label: string; color: string; activeColor: string }[] = [
  { value: 'present', label: '출근', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', activeColor: 'bg-green-500 text-white' },
  { value: 'late', label: '지각', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', activeColor: 'bg-yellow-500 text-white' },
  { value: 'half_day', label: '반차', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', activeColor: 'bg-blue-500 text-white' },
  { value: 'absent', label: '결근', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', activeColor: 'bg-red-500 text-white' },
];

interface InstructorSlotData {
  instructor_id: number;
  instructor_name: string;
  time_slot: TimeSlot;
  current_status?: AttendanceStatus;
  record_id?: number;
}

export default function MobileInstructorPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [instructorsBySlot, setInstructorsBySlot] = useState<Record<TimeSlot, InstructorSlotData[]>>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<Map<string, AttendanceStatus>>(new Map()); // key: `${instructor_id}-${time_slot}`
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!canEdit('schedules')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
  }, [router]);

  useEffect(() => {
    if (hasPermission) {
      loadInstructorAttendance();
    }
  }, [date, hasPermission]);

  const loadInstructorAttendance = async () => {
    setLoading(true);
    try {
      const response = await schedulesApi.getInstructorAttendanceByDate(date);

      // 시간대별 강사 정리
      const slotData: Record<TimeSlot, InstructorSlotData[]> = {
        morning: [],
        afternoon: [],
        evening: [],
      };

      // instructors_by_slot이 있으면 사용, 없으면 전체 instructors 사용
      if (response.instructors_by_slot) {
        TIME_SLOTS.forEach((slot) => {
          const instructors = response.instructors_by_slot?.[slot.value] || [];
          slotData[slot.value] = instructors.map((inst) => ({
            instructor_id: inst.id,
            instructor_name: inst.name,
            time_slot: slot.value,
          }));
        });
      } else if (response.instructors) {
        // 모든 시간대에 동일한 강사 목록 배치
        response.instructors.forEach((inst) => {
          TIME_SLOTS.forEach((slot) => {
            slotData[slot.value].push({
              instructor_id: inst.id,
              instructor_name: inst.name,
              time_slot: slot.value,
            });
          });
        });
      }

      // 기존 출근 기록 반영
      const initialMap = new Map<string, AttendanceStatus>();
      (response.attendances || []).forEach((record: InstructorAttendanceRecord) => {
        const key = `${record.instructor_id}-${record.time_slot}`;
        initialMap.set(key, record.attendance_status);

        // slotData에도 현재 상태 반영
        const slotInstructors = slotData[record.time_slot];
        const instructor = slotInstructors.find((i) => i.instructor_id === record.instructor_id);
        if (instructor) {
          instructor.current_status = record.attendance_status;
          instructor.record_id = record.id;
        }
      });

      setInstructorsBySlot(slotData);
      setAttendances(initialMap);
    } catch (err) {
      console.error('Failed to load instructor attendance:', err);
      toast.error('강사 출근 현황을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (instructorId: number, timeSlot: TimeSlot, status: AttendanceStatus) => {
    const key = `${instructorId}-${timeSlot}`;
    setAttendances((prev) => {
      const newMap = new Map(prev);
      if (newMap.get(key) === status) {
        newMap.delete(key); // 토글 해제
      } else {
        newMap.set(key, status);
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (attendances.size === 0) {
      toast.error('출근 체크할 강사를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const records: InstructorAttendanceSubmission[] = [];
      attendances.forEach((status, key) => {
        const [instructorId, timeSlot] = key.split('-');
        records.push({
          instructor_id: parseInt(instructorId),
          time_slot: timeSlot as TimeSlot,
          attendance_status: status,
        });
      });

      await schedulesApi.submitInstructorAttendance(date, { attendances: records });
      toast.success('강사 출근이 저장되었습니다.');
      loadInstructorAttendance(); // 새로고침
    } catch (err) {
      console.error('Failed to save instructor attendance:', err);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전체 출근 처리 (현재 시간대)
  const handleAllPresent = (timeSlot: TimeSlot) => {
    setAttendances((prev) => {
      const newMap = new Map(prev);
      instructorsBySlot[timeSlot].forEach((inst) => {
        const key = `${inst.instructor_id}-${timeSlot}`;
        newMap.set(key, 'present');
      });
      return newMap;
    });
  };

  if (hasPermission === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const totalInstructors = TIME_SLOTS.reduce(
    (sum, slot) => sum + instructorsBySlot[slot.value].length,
    0
  );

  return (
    <div className="min-h-screen bg-muted">
      {/* 헤더 */}
      <header className="bg-green-500 dark:bg-green-600 text-white p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">강사 출근체크</h1>
        </div>

        {/* 날짜 선택 */}
        <div className="mt-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white/20 rounded-lg px-3 py-2 text-white flex-1 [color-scheme:dark]"
          />
        </div>
      </header>

      {/* 강사 목록 */}
      <main className="p-4 pb-28">
        {totalInstructors === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {formattedDate}에<br />
              배정된 강사가 없습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="bg-card rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">{formattedDate}</p>
                  <p className="font-semibold text-foreground">체크됨: {attendances.size}건</p>
                </div>
              </div>
            </div>

            {/* 시간대별 강사 목록 */}
            {TIME_SLOTS.map((slot) => {
              const instructors = instructorsBySlot[slot.value];
              if (instructors.length === 0) return null;

              return (
                <div key={slot.value} className="mb-6">
                  {/* 시간대 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {slot.label} ({instructors.length}명)
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAllPresent(slot.value)}
                      className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      전체 출근
                    </Button>
                  </div>

                  {/* 강사 카드 목록 */}
                  <div className="space-y-3">
                    {instructors.map((instructor) => {
                      const key = `${instructor.instructor_id}-${slot.value}`;
                      const currentStatus = attendances.get(key);

                      return (
                        <div
                          key={key}
                          className="bg-card rounded-xl p-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="font-semibold text-lg text-foreground">{instructor.instructor_name}</p>
                          </div>

                          {/* 상태 버튼 */}
                          <div className="grid grid-cols-4 gap-2">
                            {STATUS_BUTTONS.map((btn) => (
                              <button
                                key={btn.value}
                                onClick={() => handleStatusChange(instructor.instructor_id, slot.value, btn.value)}
                                className={`py-3 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                                  currentStatus === btn.value ? btn.activeColor : btn.color
                                }`}
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      {/* 저장 버튼 (하단 고정) */}
      {totalInstructors > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-area-inset">
          <Button
            onClick={handleSave}
            disabled={saving || attendances.size === 0}
            className="w-full py-6 text-lg bg-green-500 hover:bg-green-600"
          >
            {saving ? '저장 중...' : `저장 (${attendances.size}건 체크됨)`}
          </Button>
        </div>
      )}
    </div>
  );
}
