'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
  X,
  HelpCircle
} from 'lucide-react';

interface Student {
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
  students: Student[];
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOTS: { key: TimeSlot; label: string }[] = [
  { key: 'morning', label: '오전' },
  { key: 'afternoon', label: '오후' },
  { key: 'evening', label: '저녁' }
];

const STATUS_CONFIG = {
  present: { label: '출석', color: 'bg-green-500', icon: CheckCircle2 },
  absent: { label: '결석', color: 'bg-red-500', icon: XCircle },
  late: { label: '지각', color: 'bg-yellow-500', icon: Clock },
  excused: { label: '공결', color: 'bg-blue-500', icon: AlertCircle },
};

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

  const handleAttendance = async (studentId: number, status: string, studentName?: string) => {
    if (!schedule) return;

    // 현재 학생의 출석 상태 확인
    const currentStudent = schedule.students.find(s => s.student_id === studentId);
    // 같은 상태를 다시 클릭하면 취소 (토글)
    const isToggleOff = currentStudent?.attendance_status === status;

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
  const saveAttendance = async (studentId: number, status: string, notes?: string) => {
    if (!schedule) return;

    const isToggleOff = status === 'none';
    const uiStatus = isToggleOff ? null : status;

    setSaving(studentId);
    try {
      await apiClient.post(`/schedules/${schedule.id}/attendance`, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: status,
          notes: notes
        }]
      });

      // Update local state
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
    } catch (error) {
      console.error('Failed to update attendance:', error);
    } finally {
      setSaving(null);
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  // Stats
  const stats = schedule?.students.reduce(
    (acc, s) => {
      if (s.attendance_status === 'present' || s.attendance_status === 'late') {
        acc.present++;
      } else if (s.attendance_status === 'absent') {
        acc.absent++;
      } else if (s.attendance_status === 'excused') {
        acc.excused++;
      } else {
        acc.notMarked++;
      }
      return acc;
    },
    { present: 0, absent: 0, excused: 0, notMarked: 0 }
  ) || { present: 0, absent: 0, excused: 0, notMarked: 0 };

  return (
    <div className="space-y-4">
      {/* 날짜 선택 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">{formatDate(date)}</p>
            {isToday && (
              <span className="text-sm text-blue-500 font-medium">오늘</span>
            )}
          </div>

          <button
            onClick={() => handleDateChange(1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* 시간대 탭 */}
      <div className="bg-white rounded-2xl p-2 shadow-sm">
        <div className="flex gap-2">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.key}
              onClick={() => setTimeSlot(slot.key)}
              className={`flex-1 py-3 rounded-xl font-medium transition ${
                timeSlot === slot.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 active:bg-slate-200'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 */}
      {schedule && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-slate-800">{schedule.students.length}</p>
            <p className="text-xs text-slate-500">전체</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-green-600">출석</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-red-600">결석</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.notMarked}</p>
            <p className="text-xs text-yellow-600">미체크</p>
          </div>
        </div>
      )}

      {/* 학생 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : !schedule || schedule.students.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">배정된 학생이 없습니다</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'
        }`}>
          {schedule.students.map(student => (
            <div
              key={student.student_id}
              className={`bg-white rounded-2xl p-4 shadow-sm ${
                saving === student.student_id ? 'opacity-50' : ''
              }`}
            >
              {/* 학생 정보 */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 truncate">{student.student_name}</p>
                  {!!student.is_trial && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                      체험
                    </span>
                  )}
                  {!!student.is_makeup && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                      보충
                    </span>
                  )}
                </div>
                {student.grade && String(student.grade) !== '0' && String(student.grade) !== '00' && String(student.grade).trim() !== '' && (
                  <p className="text-sm text-slate-500">{student.grade}</p>
                )}
              </div>

              {/* 현재 상태 표시 */}
              {student.attendance_status && (
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm ${
                    STATUS_CONFIG[student.attendance_status as keyof typeof STATUS_CONFIG]?.color || 'bg-slate-400'
                  }`}>
                    {STATUS_CONFIG[student.attendance_status as keyof typeof STATUS_CONFIG]?.label || student.attendance_status}
                  </span>
                </div>
              )}

              {/* 결석/공결 사유 표시 */}
              {(student.attendance_status === 'absent' || student.attendance_status === 'excused') && student.notes && (
                <div className={`mb-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                  student.attendance_status === 'excused'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">사유: {student.notes}</span>
                </div>
              )}

              {/* 출석 버튼 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAttendance(student.student_id, 'present', student.student_name)}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'present'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-100 text-green-700 active:bg-green-200'
                  }`}
                >
                  출석
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'absent', student.student_name)}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'absent'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-100 text-red-700 active:bg-red-200'
                  }`}
                >
                  결석
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'late', student.student_name)}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'late'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-100 text-yellow-700 active:bg-yellow-200'
                  }`}
                >
                  지각
                </button>
                <button
                  onClick={() => handleAttendance(student.student_id, 'excused', student.student_name)}
                  disabled={saving === student.student_id}
                  className={`py-3 rounded-xl font-medium transition active:scale-95 ${
                    student.attendance_status === 'excused'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-100 text-blue-700 active:bg-blue-200'
                  }`}
                >
                  공결
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 결석/공결 사유 입력 모달 */}
      {showReasonModal && reasonModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleReasonCancel}>
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
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
                className="flex-1 py-4 rounded-xl font-medium bg-slate-100 text-slate-600 active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleReasonConfirm}
                disabled={!reasonModalData.reason || (reasonModalData.reason === '기타' && !reasonModalData.customReason.trim())}
                className={`flex-1 py-4 rounded-xl font-medium text-white active:scale-95 transition-all disabled:opacity-50 ${
                  reasonModalData.status === 'excused'
                    ? 'bg-blue-500'
                    : 'bg-red-500'
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
