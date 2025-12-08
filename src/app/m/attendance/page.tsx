'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit } from '@/lib/utils/permissions';
import { schedulesApi } from '@/lib/api/schedules';
import { ArrowLeft, Check, X, Clock, AlertCircle, Calendar, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type {
  TimeSlot,
  AttendanceStatus,
  Attendance,
  ClassSchedule,
  AttendanceSubmission,
} from '@/lib/types/schedule';

const TIME_SLOTS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

const STATUS_BUTTONS: { value: AttendanceStatus; label: string; color: string; activeColor: string }[] = [
  { value: 'present', label: '출석', color: 'bg-gray-100 text-gray-600', activeColor: 'bg-green-500 text-white' },
  { value: 'late', label: '지각', color: 'bg-gray-100 text-gray-600', activeColor: 'bg-yellow-500 text-white' },
  { value: 'absent', label: '결석', color: 'bg-gray-100 text-gray-600', activeColor: 'bg-red-500 text-white' },
  { value: 'excused', label: '공결', color: 'bg-gray-100 text-gray-600', activeColor: 'bg-blue-500 text-white' },
];

export default function MobileAttendancePage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('afternoon');
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [students, setStudents] = useState<(Attendance & { phone?: string; parent_phone?: string; grade?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
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
      loadSchedule();
    }
  }, [date, timeSlot, hasPermission]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // 해당 날짜/시간대의 스케줄 조회
      const schedules = await schedulesApi.getSchedules({
        start_date: date,
        end_date: date,
        time_slot: timeSlot,
      });

      console.log('[DEBUG] getSchedules 결과:', schedules.length, '개, time_slot:', timeSlot);
      if (schedules.length > 0) {
        const scheduleId = schedules[0].id;
        console.log('[DEBUG] 선택된 스케줄 ID:', scheduleId, '시간대:', schedules[0].time_slot);
        setSchedule(schedules[0]);

        // 출석 대상 학생 목록 조회
        const response = await schedulesApi.getAttendance(scheduleId);
        console.log('[DEBUG] 출석 학생 수:', response.students?.length || 0);
        setStudents(response.students || []);

        // 기존 출석 상태 로드
        const initialMap = new Map<number, AttendanceStatus>();
        (response.students || []).forEach((s: Attendance) => {
          if (s.attendance_status) {
            initialMap.set(s.student_id, s.attendance_status);
          }
        });
        setAttendances(initialMap);
      } else {
        setSchedule(null);
        setStudents([]);
        setAttendances(new Map());
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      toast.error('스케줄을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendances((prev) => {
      const newMap = new Map(prev);
      if (newMap.get(studentId) === status) {
        newMap.delete(studentId); // 토글 해제
      } else {
        newMap.set(studentId, status);
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (!schedule) {
      toast.error('저장할 스케줄이 없습니다.');
      return;
    }

    if (attendances.size === 0) {
      toast.error('출석 체크할 학생을 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const records: AttendanceSubmission[] = [];
      attendances.forEach((status, studentId) => {
        records.push({
          student_id: studentId,
          attendance_status: status,
        });
      });

      await schedulesApi.submitAttendance(schedule.id, {
        attendance_records: records,
      });

      toast.success('출석이 저장되었습니다.');
      loadSchedule(); // 새로고침
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전체 출석 처리
  const handleAllPresent = () => {
    const newMap = new Map<number, AttendanceStatus>();
    students.forEach((s) => {
      newMap.set(s.student_id, 'present');
    });
    setAttendances(newMap);
  };

  // 전화걸기
  const handleCall = (phone?: string, parentPhone?: string) => {
    const numberToCall = phone || parentPhone;
    if (!numberToCall) {
      toast.error('등록된 전화번호가 없습니다.');
      return;
    }
    window.location.href = `tel:${numberToCall}`;
  };

  if (hasPermission === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-blue-500 text-white p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">학생 출석체크</h1>
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

        {/* 시간대 선택 */}
        <div className="mt-3 flex gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot.value}
              onClick={() => setTimeSlot(slot.value)}
              className={`flex-1 py-2.5 rounded-lg font-medium transition ${
                timeSlot === slot.value
                  ? 'bg-white text-blue-500'
                  : 'bg-white/20 text-white'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </header>

      {/* 학생 목록 */}
      <main className="p-4 pb-28">
        {!schedule ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {formattedDate} {TIME_SLOTS.find((s) => s.value === timeSlot)?.label}에<br />
              등록된 수업이 없습니다.
            </p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">배정된 학생이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">{formattedDate}</p>
                  <p className="font-semibold">총 {students.length}명</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAllPresent}
                  className="text-green-600 border-green-300"
                >
                  <Check className="h-4 w-4 mr-1" />
                  전체 출석
                </Button>
              </div>
            </div>

            {/* 학생 카드 목록 */}
            <div className="space-y-3">
              {students.map((student) => {
                const currentStatus = attendances.get(student.student_id);
                return (
                  <div
                    key={student.student_id}
                    className="bg-white rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">{student.student_name}</p>
                          {(student as { is_season_student?: boolean }).is_season_student && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                              시즌
                            </span>
                          )}
                          {student.is_makeup && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              보충
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {(student as { grade?: string }).grade || ''}
                          {student.student_number && ` (${student.student_number})`}
                        </p>
                      </div>

                      {/* 전화걸기 버튼 - 학부모 전번 우선 */}
                      <button
                        onClick={() => handleCall(
                          (student as { parent_phone?: string }).parent_phone,
                          (student as { phone?: string }).phone
                        )}
                        className="p-2 text-gray-400 hover:text-green-500 transition"
                      >
                        <Phone className="h-5 w-5" />
                      </button>
                    </div>

                    {/* 상태 버튼 */}
                    <div className="grid grid-cols-4 gap-2">
                      {STATUS_BUTTONS.map((btn) => (
                        <button
                          key={btn.value}
                          onClick={() => handleStatusChange(student.student_id, btn.value)}
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
          </>
        )}
      </main>

      {/* 저장 버튼 (하단 고정) */}
      {schedule && students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-area-inset">
          <Button
            onClick={handleSave}
            disabled={saving || attendances.size === 0}
            className="w-full py-6 text-lg bg-blue-500 hover:bg-blue-600"
          >
            {saving ? '저장 중...' : `저장 (${attendances.size}명 체크됨)`}
          </Button>
        </div>
      )}
    </div>
  );
}
