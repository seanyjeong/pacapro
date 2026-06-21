'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
  X,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { AttendanceCard, type Student, type AttendanceStatus } from '@/components/attendance/AttendanceCard';
import { StatsDashboard } from '@/components/attendance/StatsDashboard';
import { QuickActionsToolbar } from '@/components/attendance/QuickActionsToolbar';
import { SearchFilter, type FilterOptions } from '@/components/attendance/SearchFilter';
import { Confetti } from '@/components/attendance/Confetti';
import { hapticForStatus } from '@/lib/attendance/haptics';
import { debounce } from '@/lib/attendance/debounce';
import { staggerContainer, cardVariants } from '@/lib/attendance/animations';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface TabletStudent {
  student_id: number;
  student_name: string;
  grade: string;
  attendance_status: string | null;
  notes: string | null;
  is_trial: boolean;
  trial_remaining: number;
  season_type: string | null;
  is_makeup: boolean;
}

interface Schedule {
  id: number;
  class_date: string;
  time_slot: string;
  students: TabletStudent[];
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOTS: { key: TimeSlot; label: string }[] = [
  { key: 'morning', label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'evening', label: '저녁' }
];


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

export default function TabletAttendancePage() {
  const orientation = useOrientation();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({ status: 'all', studentType: 'all' });
  const [showSearch, setShowSearch] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // 결석/공결 사유 모달 상태
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalData, setReasonModalData] = useState<{
    studentId: number;
    studentName: string;
    status: 'absent' | 'excused';
    reason: string;
    customReason: string;
  } | null>(null);

  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ schedule: Schedule | null }>('/schedules/slot', {
        params: { date, time_slot: timeSlot }
      });
      setSchedule(res.schedule);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [date, timeSlot]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  const handleDateChange = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split('T')[0]);
  };

  const handleAttendance = async (studentId: number, status: AttendanceStatus, studentName?: string) => {
    if (!schedule) return;

    // 현재 학생의 출석 상태 확인
    const currentStudent = schedule.students.find(s => s.student_id === studentId);
    // 같은 상태를 다시 클릭하면 취소 (토글)
    const isToggleOff = currentStudent?.attendance_status === status;

    if (isToggleOff) {
      await saveAttendance(studentId, 'none', undefined);
      return;
    }

    // Haptic feedback
    hapticForStatus(status);

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

  // 실제 출석 저장 함수 with optimistic updates
  const saveAttendance = async (studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
    if (!schedule) return;

    const isToggleOff = status === 'none';
    const uiStatus = isToggleOff ? null : status;

    // Optimistic update
    const previousSchedule = schedule;
    setSchedule(prev => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(s =>
          s.student_id === studentId
            ? { ...s, attendance_status: uiStatus, notes: notes || null }
            : s
        )
      };
    });

    setSaving(studentId);
    try {
      await apiClient.post(`/schedules/${schedule.id}/attendance`, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: status,
          notes: notes
        }]
      });
    } catch (error) {
      console.error('Failed to update attendance:', error);
      // Revert on error
      setSchedule(previousSchedule);
    } finally {
      setSaving(null);
    }
  };

  // Debounced save for better performance
  const debouncedSave = useCallback(
    debounce((studentId: number, status: AttendanceStatus | 'none', notes?: string) => {
      saveAttendance(studentId, status, notes);
    }, 300),
    [schedule]
  );

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  // Memoized filtered students for performance
  const filteredStudents = useMemo(() => {
    if (!schedule) return [];
    
    return schedule.students.filter((student) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!student.student_name.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'not_marked') {
        if (student.attendance_status !== null) return false;
      } else {
        if (student.attendance_status !== filters.status) return false;
      }
    }

    // Student type filter
    if (filters.studentType && filters.studentType !== 'all') {
      if (filters.studentType === 'trial' && !student.is_trial) return false;
      if (filters.studentType === 'makeup' && !student.is_makeup) return false;
      if (filters.studentType === 'season' && !student.season_type) return false;
      if (filters.studentType === 'regular' && (student.is_trial || student.is_makeup || student.season_type)) return false;
    }

      return true;
    });
  }, [schedule, searchQuery, filters]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '/',
      callback: () => setShowSearch(true),
      description: '검색 열기',
    },
    {
      key: 'Escape',
      callback: () => setShowSearch(false),
      description: '검색 닫기',
    },
  ], !showReasonModal);

  // Stats
  const stats = schedule?.students.reduce(
    (acc, s) => {
      if (s.attendance_status === 'present') {
        acc.present++;
      } else if (s.attendance_status === 'late') {
        acc.late++;
      } else if (s.attendance_status === 'absent') {
        acc.absent++;
      } else if (s.attendance_status === 'excused') {
        acc.excused++;
      } else {
        acc.notMarked++;
      }
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 }
  ) || { present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 };

  return (
    <div className="space-y-4 pb-6">
      {/* 날짜 선택 */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-4 shadow-md"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition"
          >
            <ChevronLeft size={24} className="dark:text-slate-200" />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatDate(date)}</p>
            {isToday && (
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">오늘</span>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition"
          >
            <ChevronRight size={24} className="dark:text-slate-200" />
          </button>
        </div>
      </motion.div>

      {/* 시간대 탭 */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-strong rounded-2xl p-2 shadow-md"
      >
        <div className="flex gap-2">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.key}
              onClick={() => setTimeSlot(slot.key)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                timeSlot === slot.key
                  ? 'bg-attendance-present text-white shadow-lg'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Search & Filter */}
      {schedule && showSearch && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <SearchFilter
            onSearch={setSearchQuery}
            onFilter={setFilters}
            showFilters={true}
          />
        </motion.div>
      )}

      {/* 통계 대시보드 - 가로모드에서 학생 많으면 학생 목록 옆에 표시 */}
      {schedule && !(orientation === 'landscape' && schedule.students.length > 8) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <StatsDashboard
            stats={{
              total: filteredStudents.length,
              present: stats.present,
              absent: stats.absent,
              late: stats.late,
              excused: stats.excused,
              notMarked: stats.notMarked,
            }}
            layout="grid"
          />
        </motion.div>
      )}

      {/* 학생 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : !schedule || schedule.students.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-2xl p-8 shadow-md text-center"
        >
          <Users size={48} className="mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">배정된 학생이 없습니다</p>
        </motion.div>
      ) : (
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className={`
            ${orientation === 'landscape' && schedule.students.length > 8
              ? 'grid grid-cols-[1fr_280px] gap-4'
              : ''
            }
          `}
        >
          {/* Student Grid - 왼쪽 */}
          <div className={`grid gap-3 ${
            orientation === 'landscape' && filteredStudents.length > 8
              ? 'grid-cols-4'
              : orientation === 'landscape'
                ? 'grid-cols-5'
                : 'grid-cols-3'
          }`}>
            <AnimatePresence mode="popLayout">
              {filteredStudents.map((student, index) => (
                <motion.div
                  key={student.student_id}
                  custom={index}
                  variants={cardVariants}
                  layout
                >
                  <AttendanceCard
                    student={{
                      student_id: student.student_id,
                      student_name: student.student_name,
                      grade: student.grade,
                      attendance_status: student.attendance_status as AttendanceStatus | null,
                      notes: student.notes,
                      is_trial: student.is_trial,
                      trial_remaining: student.trial_remaining,
                      is_makeup: student.is_makeup,
                      is_season_student: !!student.season_type,
                    }}
                    onStatusChange={(status) => handleAttendance(student.student_id, status, student.student_name)}
                    layout="tablet"
                    saving={saving === student.student_id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Side Dashboard - 오른쪽 (가로모드 + 학생 많을 때) */}
          {orientation === 'landscape' && filteredStudents.length > 8 && (
            <div className="sticky top-4 self-start">
              <StatsDashboard
                stats={{
                  total: schedule.students.length,
                  present: stats.present,
                  absent: stats.absent,
                  late: stats.late,
                  excused: stats.excused,
                  notMarked: stats.notMarked,
                }}
                layout="vertical"
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Actions Toolbar */}
      {schedule && filteredStudents.length > 0 && showToolbar && (
        <QuickActionsToolbar
          onSearch={() => setShowSearch(!showSearch)}
          onQuickAttendance={async () => {
            if (!schedule || saving) return;
            
            const allPresent = schedule.students.every(s => s.attendance_status === 'present');
            if (allPresent) {
              // Already all present
              return;
            }

            setSaving(-1);
            try {
              const records = schedule.students.map(s => ({
                student_id: s.student_id,
                attendance_status: 'present' as AttendanceStatus,
              }));

              await apiClient.post(`/schedules/${schedule.id}/attendance`, {
                attendance_records: records,
              });

              // Update local state
              setSchedule(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  students: prev.students.map(s => ({
                    ...s,
                    attendance_status: 'present',
                  })),
                };
              });

              // Show confetti celebration
              setShowConfetti(true);
            } catch (error) {
              console.error('Failed to mark all present:', error);
            } finally {
              setSaving(null);
            }
          }}
          position="bottom"
        />
      )}

      {/* 결석/공결 사유 입력 모달 */}
      <AnimatePresence>
        {showReasonModal && reasonModalData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            onClick={handleReasonCancel}
          >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-strong rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {reasonModalData.status === 'excused' ? (
                  <>
                    <AlertCircle className="h-6 w-6 text-blue-500" />
                    공결 사유
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    결석 사유
                  </>
                )}
              </h3>
              <button onClick={handleReasonCancel} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* 학생 정보 */}
            <div className="text-center py-4 mb-4">
              <p className="font-bold text-2xl text-slate-800">{reasonModalData.studentName}</p>
              <span className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-medium ${
                reasonModalData.status === 'excused'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {reasonModalData.status === 'excused' ? '공결' : '결석'}
              </span>
            </div>

            {/* 공결 설명 */}
            {reasonModalData.status === 'excused' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">공결이란?</p>
                    <p className="text-blue-700">
                      공식적 결석으로, 원장님의 승인이 필요합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 결석 설명 */}
            {reasonModalData.status === 'absent' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">결석 안내</p>
                    <p className="text-red-700">
                      일반 결석은 학생 본인 책임이며, 별도의 보상이 없습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 사유 선택 */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-slate-700">사유 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {(reasonModalData.status === 'excused' ? EXCUSED_REASONS : ABSENT_REASONS).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReasonModalData({ ...reasonModalData, reason: option.value, customReason: '' })}
                    className={`p-4 border-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                      reasonModalData.reason === option.value
                        ? reasonModalData.status === 'excused'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
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
                  className={`w-full p-4 border-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    reasonModalData.reason === '기타'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  기타 (직접 입력)
                </button>
              )}
            </div>

            {/* 기타 사유 입력 */}
            {reasonModalData.reason === '기타' && (
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-slate-700">사유 입력</label>
                <textarea
                  value={reasonModalData.customReason}
                  onChange={(e) => setReasonModalData({ ...reasonModalData, customReason: e.target.value })}
                  placeholder="사유를 입력하세요..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReasonCancel}
                className="flex-1 py-4 rounded-xl font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleReasonConfirm}
                disabled={!reasonModalData.reason || (reasonModalData.reason === '기타' && !reasonModalData.customReason.trim())}
                className={`flex-1 py-4 rounded-xl font-medium text-white active:scale-95 transition-all disabled:opacity-50 ${
                  reasonModalData.status === 'excused'
                    ? 'bg-blue-500/80 dark:bg-blue-600'
                    : 'bg-red-500/80 dark:bg-red-600'
                }`}
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Confetti Animation */}
      <Confetti trigger={showConfetti} />
    </div>
  );
}
