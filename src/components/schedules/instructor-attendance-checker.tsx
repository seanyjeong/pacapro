'use client';

/**
 * 강사 출근 체크 컴포넌트
 * 시간대(오전/오후/저녁) + 상태(출근/지각/결근/반차) 혼합형
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, UserCheck, Clock, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { schedulesApi, type InstructorAttendanceRecord, type InstructorAttendanceSubmission } from '@/lib/api/schedules';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import { toast } from 'sonner';

type TimeSlot = 'morning' | 'afternoon' | 'evening';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '출근',
  absent: '결근',
  late: '지각',
  half_day: '반차',
};

const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800 border-green-300',
  absent: 'bg-red-100 text-red-800 border-red-300',
  late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  half_day: 'bg-blue-100 text-blue-800 border-blue-300',
};

interface InstructorAttendanceCheckerProps {
  date: string;
  onSuccess?: () => void;
}

interface EditedAttendance {
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export function InstructorAttendanceChecker({ date, onSuccess }: InstructorAttendanceCheckerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instructorsBySlot, setInstructorsBySlot] = useState<Record<TimeSlot, { id: number; name: string }[]>>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [existingRecords, setExistingRecords] = useState<InstructorAttendanceRecord[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>('afternoon');

  // 편집 상태: Map<instructorId, EditedAttendance>
  const [editedAttendances, setEditedAttendances] = useState<Map<number, EditedAttendance>>(new Map());

  // 현재 선택된 시간대에 배정된 강사들
  const currentSlotInstructors = instructorsBySlot[selectedTimeSlot] || [];

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await schedulesApi.getInstructorAttendanceByDate(date);

      // 시간대별 강사 목록 설정
      if (response.instructors_by_slot) {
        setInstructorsBySlot(response.instructors_by_slot);
      } else {
        // 레거시 호환: 모든 강사를 모든 시간대에 표시 (이전 API 버전)
        const allInstructors = response.instructors || [];
        setInstructorsBySlot({
          morning: allInstructors,
          afternoon: allInstructors,
          evening: allInstructors,
        });
      }
      setExistingRecords(response.attendances || []);

      // 기존 기록으로 편집 상태 초기화
      const initialEdits = new Map<number, EditedAttendance>();
      response.attendances?.forEach(record => {
        if (record.time_slot === selectedTimeSlot) {
          initialEdits.set(record.instructor_id, {
            status: record.attendance_status,
            checkInTime: record.check_in_time,
            checkOutTime: record.check_out_time,
            notes: record.notes,
          });
        }
      });
      setEditedAttendances(initialEdits);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 시간대 변경 시 해당 시간대의 기존 기록으로 초기화
  useEffect(() => {
    const initialEdits = new Map<number, EditedAttendance>();
    existingRecords.forEach(record => {
      if (record.time_slot === selectedTimeSlot) {
        initialEdits.set(record.instructor_id, {
          status: record.attendance_status,
          checkInTime: record.check_in_time,
          checkOutTime: record.check_out_time,
          notes: record.notes,
        });
      }
    });
    setEditedAttendances(initialEdits);
  }, [selectedTimeSlot, existingRecords]);

  const handleStatusChange = (instructorId: number, status: AttendanceStatus) => {
    setEditedAttendances(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(instructorId) || { status: 'present' };
      newMap.set(instructorId, { ...current, status });
      return newMap;
    });
  };

  const handleTimeChange = (instructorId: number, field: 'checkInTime' | 'checkOutTime', value: string) => {
    setEditedAttendances(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(instructorId) || { status: 'present' };
      newMap.set(instructorId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSubmit = async () => {
    if (editedAttendances.size === 0) {
      toast.error('출근 체크할 강사를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const attendances: InstructorAttendanceSubmission[] = [];
      editedAttendances.forEach((data, instructorId) => {
        attendances.push({
          instructor_id: instructorId,
          time_slot: selectedTimeSlot,
          attendance_status: data.status,
          check_in_time: data.checkInTime,
          check_out_time: data.checkOutTime,
          notes: data.notes,
        });
      });

      await schedulesApi.submitInstructorAttendance(date, { attendances });
      toast.success(`${attendances.length}명의 강사 출근이 체크되었습니다.`);
      onSuccess?.();
      loadData(); // 데이터 새로고침
    } catch (err) {
      setError(err instanceof Error ? err.message : '출근 체크에 실패했습니다.');
      toast.error('출근 체크에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전체 출근 처리
  const handleMarkAllPresent = () => {
    const newMap = new Map<number, EditedAttendance>();
    currentSlotInstructors.forEach(instructor => {
      const existing = editedAttendances.get(instructor.id);
      newMap.set(instructor.id, { ...existing, status: 'present' });
    });
    setEditedAttendances(newMap);
  };

  // 시간대별 배정된 강사 수 계산
  const slotCounts = {
    morning: instructorsBySlot.morning.length,
    afternoon: instructorsBySlot.afternoon.length,
    evening: instructorsBySlot.evening.length,
  };

  // 통계 계산 (현재 선택된 시간대의 강사들만)
  const stats = {
    total: currentSlotInstructors.length,
    checked: editedAttendances.size,
    present: Array.from(editedAttendances.values()).filter(a => a.status === 'present').length,
    absent: Array.from(editedAttendances.values()).filter(a => a.status === 'absent').length,
    late: Array.from(editedAttendances.values()).filter(a => a.status === 'late').length,
    halfDay: Array.from(editedAttendances.values()).filter(a => a.status === 'half_day').length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">강사 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={loadData} className="mt-4">다시 시도</Button>
        </CardContent>
      </Card>
    );
  }

  const dateObj = new Date(date);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

  return (
    <div className="space-y-6">
      {/* 헤더 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            강사 출근 체크 - {date} ({dayOfWeek})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 시간대 선택 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">시간대 선택</label>
            <div className="flex gap-2">
              {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map(slot => (
                <button
                  key={slot}
                  type="button"
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    selectedTimeSlot === slot
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedTimeSlot(slot)}
                >
                  {TIME_SLOT_LABELS[slot]}
                  {slotCounts[slot] > 0 && (
                    <span className="ml-1 text-xs">({slotCounts[slot]}명)</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-500">전체</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-sm text-gray-500">출근</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-gray-500">결근</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
              <p className="text-sm text-gray-500">지각</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.halfDay}</p>
              <p className="text-sm text-gray-500">반차</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 강사 출근 체크 리스트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>강사 출근 현황</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
                전체 출근
              </Button>
              <Button onClick={handleSubmit} disabled={saving || editedAttendances.size === 0}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                저장
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentSlotInstructors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>등록된 강사가 없습니다.</p>
              <p className="text-sm mt-1">강사 관리에서 강사를 먼저 등록해주세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentSlotInstructors.map(instructor => {
                const edited = editedAttendances.get(instructor.id);
                const isChecked = !!edited;

                return (
                  <div
                    key={instructor.id}
                    className={cn(
                      'p-4 border rounded-lg transition-colors',
                      isChecked ? 'border-primary-300 bg-primary-50/50' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                          isChecked ? 'bg-primary-500' : 'bg-gray-400'
                        )}>
                          {instructor.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{instructor.name}</p>
                          <p className="text-sm text-gray-500">
                            {isChecked ? ATTENDANCE_STATUS_LABELS[edited!.status] : '미체크'}
                          </p>
                        </div>
                      </div>
                      {isChecked && edited && (
                        <span className={cn(
                          'px-3 py-1 rounded-full text-sm font-medium border',
                          ATTENDANCE_STATUS_COLORS[edited.status]
                        )}>
                          {ATTENDANCE_STATUS_LABELS[edited.status]}
                        </span>
                      )}
                    </div>

                    {/* 출근 상태 버튼 */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {(['present', 'late', 'absent', 'half_day'] as AttendanceStatus[]).map(status => (
                        <button
                          key={status}
                          type="button"
                          className={cn(
                            'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                            edited?.status === status
                              ? ATTENDANCE_STATUS_COLORS[status]
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          )}
                          onClick={() => handleStatusChange(instructor.id, status)}
                        >
                          {ATTENDANCE_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>

                    {/* 시간 입력 (출근 또는 지각일 때만) */}
                    {isChecked && (edited?.status === 'present' || edited?.status === 'late') && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">출근 시간</label>
                          <input
                            type="time"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={edited?.checkInTime || ''}
                            onChange={(e) => handleTimeChange(instructor.id, 'checkInTime', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">퇴근 시간</label>
                          <input
                            type="time"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={edited?.checkOutTime || ''}
                            onChange={(e) => handleTimeChange(instructor.id, 'checkOutTime', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
