'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit } from '@/lib/utils/permissions';
import { schedulesApi } from '@/lib/api/schedules';
import { ArrowLeft, Check, X, AlertCircle, Calendar, Phone, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type {
  TimeSlot,
  AttendanceStatus,
  Attendance,
  ClassSchedule,
  AttendanceSubmission,
} from '@/lib/types/schedule';

// 공결 사유 옵션
const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
];

// 결석 사유 옵션
const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
  { value: '기타', label: '기타' },
];

const TIME_SLOTS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

const STATUS_BUTTONS: { value: AttendanceStatus; label: string; color: string; activeColor: string }[] = [
  { value: 'present', label: '출석', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-emerald-500/80 dark:bg-emerald-500/70 text-white dark:shadow-[0_0_15px_rgba(16,185,129,0.3)]' },
  { value: 'late', label: '지각', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-amber-500/80 dark:bg-amber-500/70 text-white dark:shadow-[0_0_15px_rgba(245,158,11,0.3)]' },
  { value: 'absent', label: '결석', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-red-500/80 dark:bg-red-500/70 text-white dark:shadow-[0_0_15px_rgba(239,68,68,0.3)]' },
  { value: 'excused', label: '공결', color: 'bg-secondary text-muted-foreground', activeColor: 'bg-blue-500/80 dark:bg-blue-500/70 text-white dark:shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
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
  const [, setOriginalAttendances] = useState<Map<number, AttendanceStatus>>(new Map());
  const [attendanceNotes, setAttendanceNotes] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // 결석/공결 사유 모달 상태
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalData, setReasonModalData] = useState<{
    studentId: number;
    studentName: string;
    status: 'absent' | 'excused';
    reason: string;
    customReason: string;
  } | null>(null);

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

        // 기존 출석 상태 및 notes 로드
        const initialMap = new Map<number, AttendanceStatus>();
        const notesMap = new Map<number, string>();
        const scheduleStudents = (response.schedule?.students || []) as Array<{ student_id: number; notes?: string }>;
        studentList.forEach((s) => {
          if (s.attendance_status) {
            initialMap.set(s.student_id, s.attendance_status);
          }
          // API 응답에서 notes 로드
          const apiStudent = scheduleStudents.find((st) => st.student_id === s.student_id);
          if (apiStudent?.notes) {
            notesMap.set(s.student_id, apiStudent.notes);
          }
        });
        setAttendances(initialMap);
        setOriginalAttendances(new Map(initialMap)); // 원본 저장
        setAttendanceNotes(notesMap);
      } else {
        setSchedule(null);
        setStudents([]);
        setAttendances(new Map());
        setOriginalAttendances(new Map());
        setAttendanceNotes(new Map());
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      toast.error('스케줄을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 출석 상태 변경 및 자동 저장
  const handleStatusChange = async (studentId: number, status: AttendanceStatus, studentName?: string) => {
    if (!schedule || saving) return;

    const currentStatus = attendances.get(studentId);
    const isToggleOff = currentStatus === status;

    // 같은 상태를 다시 선택하면 토글 (해제)
    if (isToggleOff) {
      await saveAttendance(studentId, 'none', undefined);
      return;
    }

    // 결석 또는 공결 선택 시 사유 모달 표시
    if ((status === 'absent' || status === 'excused') && studentName) {
      setReasonModalData({
        studentId,
        studentName,
        status,
        reason: '',
        customReason: '',
      });
      setShowReasonModal(true);
      return;
    }

    // 출석/지각은 바로 저장
    await saveAttendance(studentId, status, undefined);
  };

  // 실제 출석 저장 함수
  const saveAttendance = async (studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
    if (!schedule) return;

    const currentStatus = attendances.get(studentId);
    const isToggleOff = status === 'none';

    // UI 즉시 업데이트
    setAttendances((prev) => {
      const newMap = new Map(prev);
      if (isToggleOff) {
        newMap.delete(studentId);
      } else {
        newMap.set(studentId, status as AttendanceStatus);
      }
      return newMap;
    });

    if (notes !== undefined) {
      setAttendanceNotes((prev) => {
        const newMap = new Map(prev);
        if (notes) {
          newMap.set(studentId, notes);
        } else {
          newMap.delete(studentId);
        }
        return newMap;
      });
    }

    // 자동 저장
    setSaving(true);
    try {
      await schedulesApi.submitAttendance(schedule.id, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: status,
          notes: notes,
        }],
      });
      // 원본 상태 업데이트
      setOriginalAttendances((prev) => {
        const newMap = new Map(prev);
        if (isToggleOff) {
          newMap.delete(studentId);
        } else {
          newMap.set(studentId, status as AttendanceStatus);
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

  // 사유 모달 확인 핸들러
  const handleReasonConfirm = async () => {
    if (!reasonModalData) return;

    const { studentId, status, reason, customReason } = reasonModalData;
    const finalNotes = reason === '기타' ? customReason : reason;

    setShowReasonModal(false);
    setReasonModalData(null);

    await saveAttendance(studentId, status, finalNotes);
  };

  // 사유 모달 취소 핸들러
  const handleReasonCancel = () => {
    setShowReasonModal(false);
    setReasonModalData(null);
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
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-foreground flex-1
                       dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                  className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-800"
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
                          {!!(student as { is_trial?: boolean }).is_trial && (() => {
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

                    {/* 결석/공결 사유 표시 */}
                    {(currentStatus === 'absent' || currentStatus === 'excused') && attendanceNotes.get(student.student_id) && (
                      <div className={`mb-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                        currentStatus === 'excused'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>사유: {attendanceNotes.get(student.student_id)}</span>
                      </div>
                    )}

                    {/* 상태 버튼 */}
                    <div className="grid grid-cols-4 gap-2">
                      {STATUS_BUTTONS.map((btn) => (
                        <button
                          key={btn.value}
                          onClick={() => handleStatusChange(student.student_id, btn.value, student.student_name)}
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

      {/* 결석/공결 사유 입력 모달 */}
      {showReasonModal && reasonModalData && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-end justify-center z-50" onClick={handleReasonCancel}>
          <div
            className="bg-card w-full max-w-lg rounded-t-2xl p-5 pb-8 safe-area-pb animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                {reasonModalData.status === 'excused' ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    공결 사유
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    결석 사유
                  </>
                )}
              </h3>
              <button onClick={handleReasonCancel} className="p-2 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 학생 정보 */}
            <div className="text-center py-3 mb-4">
              <p className="font-semibold text-xl text-foreground">{reasonModalData.studentName}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                reasonModalData.status === 'excused'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                  : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
              }`}>
                {reasonModalData.status === 'excused' ? '공결' : '결석'}
              </span>
            </div>

            {/* 공결 설명 */}
            {reasonModalData.status === 'excused' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">공결이란?</p>
                    <p className="text-blue-700 dark:text-blue-400">
                      공식적 결석으로, 원장님의 승인이 필요합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 결석 설명 */}
            {reasonModalData.status === 'absent' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">
                    <p className="font-semibold mb-1">결석 안내</p>
                    <p className="text-red-700 dark:text-red-400">
                      일반 결석은 학생 본인 책임이며, 별도의 보상이 없습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 사유 선택 */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-foreground">사유 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {(reasonModalData.status === 'excused' ? EXCUSED_REASONS : ABSENT_REASONS).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReasonModalData({ ...reasonModalData, reason: option.value, customReason: '' })}
                    className={`p-4 border rounded-xl text-sm font-medium transition-all active:scale-95 ${
                      reasonModalData.reason === option.value
                        ? reasonModalData.status === 'excused'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'border-border bg-secondary text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {/* 기타 옵션 (공결에만) */}
              {reasonModalData.status === 'excused' && (
                <button
                  type="button"
                  onClick={() => setReasonModalData({ ...reasonModalData, reason: '기타', customReason: '' })}
                  className={`w-full p-4 border rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    reasonModalData.reason === '기타'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'border-border bg-secondary text-foreground'
                  }`}
                >
                  기타 (직접 입력)
                </button>
              )}
            </div>

            {/* 기타 사유 입력 */}
            {reasonModalData.reason === '기타' && (
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-foreground">사유 입력</label>
                <textarea
                  value={reasonModalData.customReason}
                  onChange={(e) => setReasonModalData({ ...reasonModalData, customReason: e.target.value })}
                  placeholder="사유를 입력하세요..."
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground resize-none"
                />
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReasonCancel}
                className="flex-1 py-4 rounded-xl font-medium bg-secondary text-muted-foreground active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleReasonConfirm}
                disabled={!reasonModalData.reason || (reasonModalData.reason === '기타' && !reasonModalData.customReason.trim())}
                className={`flex-1 py-4 rounded-xl font-medium text-white active:scale-95 transition-all disabled:opacity-50 ${
                  reasonModalData.status === 'excused'
                    ? 'bg-blue-500/80 dark:bg-blue-500/70'
                    : 'bg-red-500/80 dark:bg-red-500/70'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
