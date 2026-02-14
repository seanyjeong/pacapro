'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit } from '@/lib/utils/permissions';
import { schedulesApi } from '@/lib/api/schedules';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, X, AlertCircle, Calendar, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AttendanceCard } from '@/components/attendance/AttendanceCard';
import { StatsDashboard } from '@/components/attendance/StatsDashboard';
import { QuickActionsToolbar } from '@/components/attendance/QuickActionsToolbar';
import { SwipeableCard } from '@/components/attendance/SwipeableCard';
import { hapticForStatus } from '@/lib/attendance/haptics';
import { staggerContainer, cardVariants } from '@/lib/attendance/animations';
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
  const [showToolbar, setShowToolbar] = useState(true);

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
  const handleStatusChange = async (studentId: number, status: 'present' | 'absent' | 'late' | 'excused', studentName?: string) => {
    if (!schedule || saving) return;

    const currentStatus = attendances.get(studentId);
    const isToggleOff = currentStatus === status;

    // Haptic feedback
    hapticForStatus(status);

    // 같은 상태를 다시 선택하면 토글 (해제)
    if (isToggleOff) {
      await saveAttendance(studentId, 'none' as AttendanceStatus, undefined);
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
    await saveAttendance(studentId, status as AttendanceStatus, undefined);
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

  const stats = {
    total: students.length,
    present: Array.from(attendances.values()).filter(s => s === 'present').length,
    absent: Array.from(attendances.values()).filter(s => s === 'absent').length,
    late: Array.from(attendances.values()).filter(s => s === 'late').length,
    excused: Array.from(attendances.values()).filter(s => s === 'excused').length,
    notMarked: students.length - attendances.size,
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* 헤더 */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-border p-4 sticky top-0 z-10 safe-area-inset backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/m')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold text-foreground">학생 출석체크</h1>
          </div>
          
          {/* Quick Stats Badge */}
          {schedule && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {stats.present}/{stats.total}
              </span>
            </div>
          )}
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
      </motion.header>

      {/* 학생 목록 */}
      <main className="p-4 pb-24 safe-area-pb">
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
            {/* 통계 대시보드 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4"
            >
              <StatsDashboard
                stats={stats}
                layout="horizontal"
              />
            </motion.div>

            {/* 학생 카드 목록 */}
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {students.map((student, index) => (
                  <motion.div
                    key={student.student_id}
                    custom={index}
                    variants={cardVariants}
                  >
                    <SwipeableCard
                      onSwipeRight={() => {
                        const currentStatus = attendances.get(student.student_id);
                        if (currentStatus !== 'present') {
                          handleStatusChange(student.student_id, 'present', student.student_name);
                        }
                      }}
                      onSwipeLeft={() => {
                        const currentStatus = attendances.get(student.student_id);
                        if (currentStatus !== 'absent') {
                          handleStatusChange(student.student_id, 'absent', student.student_name);
                        }
                      }}
                      disabled={saving}
                    >
                      <AttendanceCard
                        student={{
                          student_id: student.student_id,
                          student_name: student.student_name,
                          grade: (student as { grade?: string }).grade,
                          attendance_status: (() => {
                            const status = attendances.get(student.student_id);
                            return (status === 'present' || status === 'absent' || status === 'late' || status === 'excused') ? status : null;
                          })(),
                          notes: attendanceNotes.get(student.student_id) || null,
                          is_trial: (student as { is_trial?: boolean }).is_trial,
                          trial_remaining: (student as { trial_remaining?: number }).trial_remaining,
                          is_makeup: student.is_makeup,
                          is_season_student: (student as { is_season_student?: boolean }).is_season_student,
                          phone: (student as { phone?: string }).phone,
                          parent_phone: (student as { parent_phone?: string }).parent_phone,
                        }}
                        onStatusChange={(status) => handleStatusChange(student.student_id, status, student.student_name)}
                        onPhoneCall={handleCall}
                        layout="compact"
                        saving={saving}
                      />
                    </SwipeableCard>
                  </motion.div>
                ))}
            </motion.div>

            {/* Quick Actions Toolbar - Mobile */}
            {showToolbar && (
              <QuickActionsToolbar
                onQuickAttendance={handleAllPresent}
                position="bottom"
                className="mb-safe-area"
              />
            )}
          </>
        )}
      </main>

      {/* 저장 중 인디케이터 */}
      <AnimatePresence>
        {saving && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-attendance-present text-white px-6 py-3 rounded-full text-sm font-medium shadow-2xl"
          >
            저장 중...
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결석/공결 사유 입력 모달 */}
      <AnimatePresence>
        {showReasonModal && reasonModalData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-end justify-center z-50" 
            onClick={handleReasonCancel}
          >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="glass-strong w-full max-w-lg rounded-t-2xl p-5 pb-8 safe-area-pb shadow-2xl border-t border-border"
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
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
