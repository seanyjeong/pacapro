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
  { value: 'present', label: '출석', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-emerald-600 dark:bg-emerald-500 text-white' },
  { value: 'late', label: '지각', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-amber-500 dark:bg-amber-400 text-white' },
  { value: 'absent', label: '결석', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-red-500 dark:bg-red-400 text-white' },
  { value: 'excused', label: '공결', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-blue-500 dark:bg-blue-400 text-white' },
];

export default function MobileAttendancePage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // 현재 시간에 따라 시간대 자동 선택
  const getInitialTimeSlot = (): TimeSlot => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';      // 오전 6시~12시
    if (hour < 17) return 'afternoon';    // 12시~17시
    return 'evening';                      // 17시 이후
  };
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(getInitialTimeSlot());
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [students, setStudents] = useState<(Attendance & { phone?: string; parent_phone?: string; grade?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
  const [originalAttendances, setOriginalAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
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
      // 웹과 동일한 /schedules/slot API 사용 (attendance 테이블 기반)
      const response = await schedulesApi.getSlotData(date, timeSlot);

      if (response.schedule) {
        setSchedule(response.schedule as unknown as ClassSchedule);

        // 학생 목록 변환 (API 응답 형식에 맞춤)
        const studentList = (response.schedule.students || []).map(s => ({
          student_id: s.student_id,
          student_name: s.student_name,
          student_number: null as string | null,  // API에서 제공하지 않음
          grade: s.grade ?? '',
          attendance_status: s.attendance_status as AttendanceStatus | null,
          season_type: s.season_type,
          is_trial: s.is_trial,
          trial_remaining: s.trial_remaining,
          phone: s.phone ?? undefined,
          parent_phone: s.parent_phone ?? undefined,
          is_season_student: !!s.season_type,
          is_makeup: s.is_makeup ?? false,
        }));
        setStudents(studentList as unknown as (Attendance & { phone?: string; parent_phone?: string; grade?: string; is_season_student?: boolean })[]);

        // 기존 출석 상태 로드
        const initialMap = new Map<number, AttendanceStatus>();
        studentList.forEach((s) => {
          if (s.attendance_status) {
            initialMap.set(s.student_id, s.attendance_status);
          }
        });
        setAttendances(initialMap);
        setOriginalAttendances(new Map(initialMap)); // 원본 저장
      } else {
        setSchedule(null);
        setStudents([]);
        setAttendances(new Map());
        setOriginalAttendances(new Map());
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      toast.error('스케줄을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 출석 상태 변경 및 자동 저장
  const handleStatusChange = async (studentId: number, status: AttendanceStatus) => {
    if (!schedule || saving) return;

    const currentStatus = attendances.get(studentId);
    const isToggleOff = currentStatus === status;
    const newStatus = isToggleOff ? 'none' : status;

    // UI 즉시 업데이트
    setAttendances((prev) => {
      const newMap = new Map(prev);
      if (isToggleOff) {
        newMap.delete(studentId);
      } else {
        newMap.set(studentId, status);
      }
      return newMap;
    });

    // 자동 저장
    setSaving(true);
    try {
      await schedulesApi.submitAttendance(schedule.id, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: newStatus,
        }],
      });
      // 원본 상태 업데이트
      setOriginalAttendances((prev) => {
        const newMap = new Map(prev);
        if (isToggleOff) {
          newMap.delete(studentId);
        } else {
          newMap.set(studentId, status);
        }
        return newMap;
      });
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error('저장에 실패했습니다.');
      // 실패 시 원래 상태로 복구
      setAttendances((prev) => {
        const newMap = new Map(prev);
        if (currentStatus) {
          newMap.set(studentId, currentStatus);
        } else {
          newMap.delete(studentId);
        }
        return newMap;
      });
    } finally {
      setSaving(false);
    }
  };

  // 전체 출석 처리 (자동 저장)
  const handleAllPresent = async () => {
    if (!schedule || saving) return;

    const records: AttendanceSubmission[] = students.map((s) => ({
      student_id: s.student_id,
      attendance_status: 'present' as AttendanceStatus,
    }));

    // UI 즉시 업데이트
    const newMap = new Map<number, AttendanceStatus>();
    students.forEach((s) => {
      newMap.set(s.student_id, 'present');
    });
    setAttendances(newMap);

    setSaving(true);
    try {
      await schedulesApi.submitAttendance(schedule.id, {
        attendance_records: records,
      });
      setOriginalAttendances(new Map(newMap));
      toast.success('전체 출석 처리되었습니다.');
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error('저장에 실패했습니다.');
      loadSchedule(); // 실패 시 새로고침
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="min-h-screen bg-muted">
      {/* 헤더 */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-foreground">학생 출석체크</h1>
        </div>

        {/* 날짜 선택 */}
        <div className="mt-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-foreground flex-1"
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
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </header>

      {/* 학생 목록 */}
      <main className="p-4 pb-8">
        {!schedule ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {formattedDate} {TIME_SLOTS.find((s) => s.value === timeSlot)?.label}에<br />
              등록된 수업이 없습니다.
            </p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">배정된 학생이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="bg-card rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">{formattedDate}</p>
                  <p className="font-semibold text-foreground">총 {students.length}명</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAllPresent}
                  className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700"
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
                    className="bg-card rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg text-foreground">{student.student_name}</p>
                          {(student as { is_season_student?: boolean }).is_season_student && (
                            <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                              시즌
                            </span>
                          )}
                          {!!student.is_makeup && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                              보충
                            </span>
                          )}
                          {(student as { is_trial?: boolean }).is_trial && (() => {
                            const remaining = (student as { trial_remaining?: number }).trial_remaining ?? 2;
                            // 현재 세션 = 총 2회 - 남은 회차 + 1 (아직 출석 안 한 상태 기준)
                            const currentSession = Math.max(1, 2 - remaining + 1);

                            return (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                remaining === 0
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                  : 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300'
                              }`}>
                                {remaining === 0 ? '체험완료' : `체험 ${currentSession}/2`}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const g = String((student as { grade?: string }).grade ?? '');
                            return g && g !== '0' && g !== 'null' ? g : null;
                          })()}
                        </p>
                      </div>

                      {/* 전화걸기 버튼 - 학부모 전번 우선 */}
                      <button
                        onClick={() => handleCall(
                          (student as { parent_phone?: string }).parent_phone,
                          (student as { phone?: string }).phone
                        )}
                        className="p-2 text-muted-foreground hover:text-green-500 dark:hover:text-green-400 transition"
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

      {/* 저장 중 인디케이터 */}
      {saving && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg">
          저장 중...
        </div>
      )}
    </div>
  );
}
