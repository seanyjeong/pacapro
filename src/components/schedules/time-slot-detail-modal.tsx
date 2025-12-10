'use client';

/**
 * 타임슬롯 상세 모달
 * - 해당 날짜/시간대의 학생 목록 표시
 * - 강사 출결 체크
 * - 학생 슬롯 이동 (오전/오후/저녁)
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Sun, Sunrise, Moon, X, UserCog, Check, Clock, UserPlus, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/lib/types/schedule';
import apiClient from '@/lib/api/client';

interface AttendanceStudent {
  student_id: number;
  student_name: string;
  grade?: string | null;  // 학년
  attendance_status: string | null;
  season_type?: string | null;  // 'regular' | 'rolling' | null
  is_trial?: boolean | null;  // 체험생 여부
  trial_remaining?: number | null;  // 남은 체험 횟수
  is_makeup?: boolean | number | null;  // 보충 학생 여부
}

interface InstructorAttendance {
  instructor_id: number;
  instructor_name: string;
  attendance_status: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  time_slot?: string;
}

interface Instructor {
  id: number;
  name: string;
  salary_type: 'hourly' | 'per_class' | 'monthly' | 'mixed';
}

interface TimeSlotDetailModalProps {
  open: boolean;
  date: string | null;
  timeSlot: TimeSlot | null;
  onClose: () => void;
  onStudentMoved?: () => void;
}

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-950' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-950' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-950' },
};

const OTHER_SLOTS: Record<TimeSlot, TimeSlot[]> = {
  morning: ['afternoon', 'evening'],
  afternoon: ['morning', 'evening'],
  evening: ['morning', 'afternoon'],
};

const INSTRUCTOR_ATTENDANCE_STATUS = [
  { value: 'present', label: '출근', color: 'bg-green-500' },
  { value: 'absent', label: '결근', color: 'bg-red-500' },
  { value: 'late', label: '지각', color: 'bg-yellow-500' },
  { value: 'half_day', label: '반차', color: 'bg-blue-500' },
];

const STUDENT_ATTENDANCE_STATUS = [
  { value: 'present', label: '출석', color: 'bg-green-500' },
  { value: 'absent', label: '결석', color: 'bg-red-500' },
  { value: 'late', label: '지각', color: 'bg-yellow-500' },
  { value: 'excused', label: '공결', color: 'bg-blue-500' },
];

// 근무시간 계산 (HH:MM 형식)
function calculateHours(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

// 현재 시간 (HH:MM 형식)
function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function TimeSlotDetailModal({
  open,
  date,
  timeSlot,
  onClose,
  onStudentMoved,
}: TimeSlotDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorAttendances, setInstructorAttendances] = useState<Record<number, {
    status: string;
    checkIn?: string;
    checkOut?: string;
  }>>({});
  const [studentAttendances, setStudentAttendances] = useState<Record<number, string>>({});
  const [savingInstructor, setSavingInstructor] = useState(false);
  const [savingStudent, setSavingStudent] = useState<number | null>(null);
  const [movingStudent, setMovingStudent] = useState<number | null>(null);

  // 보충 학생 추가 관련 상태
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; grade: string; student_number: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  useEffect(() => {
    if (open && date && timeSlot) {
      loadSlotData();
      loadInstructorAttendance();
    }
  }, [open, date, timeSlot]);

  const loadSlotData = async () => {
    if (!date || !timeSlot) return;

    try {
      setLoading(true);
      const response = await apiClient.get<{
        schedule: { id: number; students: AttendanceStudent[] } | null;
      }>(`/schedules/slot?date=${date}&time_slot=${timeSlot}`);

      const studentList = response.schedule?.students || [];
      setStudents(studentList);
      setScheduleId(response.schedule?.id || null);

      // 기존 출결 상태 초기화
      const attendanceMap: Record<number, string> = {};
      studentList.forEach(s => {
        if (s.attendance_status) {
          attendanceMap[s.student_id] = s.attendance_status;
        }
      });
      setStudentAttendances(attendanceMap);
    } catch (err) {
      console.error('Failed to load slot data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadInstructorAttendance = async () => {
    if (!date || !timeSlot) return;

    try {
      const response = await apiClient.get<{
        instructors: Instructor[];
        instructors_by_slot: Record<string, Instructor[]>;
        attendances: InstructorAttendance[];
      }>(`/schedules/date/${date}/instructor-attendance`);

      // 해당 타임슬롯에 배정된 강사만 표시
      const slotInstructors = response.instructors_by_slot?.[timeSlot] || [];
      setInstructors(slotInstructors);

      // 현재 시간대의 출결 상태 매핑
      const attendanceMap: Record<number, { status: string; checkIn?: string; checkOut?: string }> = {};
      response.attendances?.forEach(att => {
        if (att.time_slot === timeSlot) {
          attendanceMap[att.instructor_id] = {
            status: att.attendance_status || '',
            checkIn: att.check_in_time || '',
            checkOut: att.check_out_time || '',
          };
        }
      });
      setInstructorAttendances(attendanceMap);
    } catch (err) {
      console.error('Failed to load instructor attendance:', err);
    }
  };

  const handleInstructorAttendance = async (instructorId: number, status: string) => {
    if (!date || !timeSlot) return;

    const current = instructorAttendances[instructorId];
    // 같은 상태 클릭하면 취소 (토글)
    const newStatus = current?.status === status ? '' : status;

    setInstructorAttendances(prev => ({
      ...prev,
      [instructorId]: { ...prev[instructorId], status: newStatus },
    }));

    try {
      setSavingInstructor(true);
      await apiClient.post(`/schedules/date/${date}/instructor-attendance`, {
        attendances: [{
          instructor_id: instructorId,
          time_slot: timeSlot,
          attendance_status: newStatus || 'absent',
          check_in_time: current?.checkIn || null,
          check_out_time: current?.checkOut || null,
        }],
      });
    } catch (err) {
      console.error('Failed to save instructor attendance:', err);
      loadInstructorAttendance();
    } finally {
      setSavingInstructor(false);
    }
  };

  const handleTimeChange = async (instructorId: number, field: 'checkIn' | 'checkOut', value: string) => {
    if (!date || !timeSlot) return;

    const current = instructorAttendances[instructorId] || { status: 'present', checkIn: '', checkOut: '' };

    setInstructorAttendances(prev => ({
      ...prev,
      [instructorId]: { ...current, [field]: value },
    }));
  };

  const saveInstructorTime = async (instructorId: number) => {
    if (!date || !timeSlot) return;

    const current = instructorAttendances[instructorId];
    if (!current) return;

    try {
      setSavingInstructor(true);
      await apiClient.post(`/schedules/date/${date}/instructor-attendance`, {
        attendances: [{
          instructor_id: instructorId,
          time_slot: timeSlot,
          attendance_status: current.status || 'present',
          check_in_time: current.checkIn || null,
          check_out_time: current.checkOut || null,
        }],
      });
    } catch (err) {
      console.error('Failed to save instructor time:', err);
      loadInstructorAttendance();
    } finally {
      setSavingInstructor(false);
    }
  };

  const handleMoveStudent = async (studentId: number, toSlot: TimeSlot) => {
    if (!date || !timeSlot) return;

    try {
      setMovingStudent(studentId);
      await apiClient.post('/schedules/slot/move', {
        date,
        from_slot: timeSlot,
        to_slot: toSlot,
        student_id: studentId,
      });
      loadSlotData();
      onStudentMoved?.();
    } catch (err) {
      console.error('Failed to move student:', err);
      toast.error('학생 이동에 실패했습니다.');
    } finally {
      setMovingStudent(null);
    }
  };

  // 학생 출결 상태 변경
  const handleStudentAttendance = async (studentId: number, status: string) => {
    if (!scheduleId) return;

    const currentStatus = studentAttendances[studentId];
    // 같은 상태 클릭하면 취소 (토글)
    const newStatus = currentStatus === status ? '' : status;

    setStudentAttendances(prev => ({
      ...prev,
      [studentId]: newStatus,
    }));

    try {
      setSavingStudent(studentId);
      await apiClient.post(`/schedules/${scheduleId}/attendance`, {
        attendance_records: [{
          student_id: studentId,
          attendance_status: newStatus || null,
        }],
      });
    } catch (err) {
      console.error('Failed to save student attendance:', err);
      // 롤백
      setStudentAttendances(prev => ({
        ...prev,
        [studentId]: currentStatus || '',
      }));
    } finally {
      setSavingStudent(null);
    }
  };

  // 학생 검색
  const handleSearchStudent = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await apiClient.get<{ students: Array<{ id: number; name: string; grade: string; student_number: string }> }>(
        `/students?search=${encodeURIComponent(query)}&status=active&limit=10`
      );
      // 이미 등록된 학생 제외
      const existingIds = new Set(students.map(s => s.student_id));
      const filtered = response.students.filter(s => !existingIds.has(s.id));
      setSearchResults(filtered);
    } catch (err) {
      console.error('Failed to search students:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 보충 학생 추가
  const handleAddMakeupStudent = async (studentId: number, studentName: string) => {
    if (!date || !timeSlot) return;

    try {
      setIsAddingStudent(true);
      await apiClient.post('/schedules/slot/student', {
        date,
        time_slot: timeSlot,
        student_id: studentId,
        is_makeup: true,
      });
      toast.success(`${studentName} 학생이 보충으로 추가되었습니다.`);
      setShowAddStudent(false);
      setSearchQuery('');
      setSearchResults([]);
      loadSlotData(); // 목록 새로고침
      onStudentMoved?.(); // 캘린더도 새로고침
    } catch (err: any) {
      console.error('Failed to add makeup student:', err);
      toast.error(err.response?.data?.message || '학생 추가에 실패했습니다.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  if (!date || !timeSlot) return null;

  const slotInfo = TIME_SLOT_INFO[timeSlot];
  const Icon = slotInfo.icon;
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T00:00:00').getDay()];
  const dateObj = new Date(date + 'T00:00:00');
  const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className={cn('px-5 py-4 border-b shrink-0', slotInfo.bgColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-full bg-white/80 dark:bg-black/30')}>
                <Icon className={cn('h-5 w-5', slotInfo.color)} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {shortDate} ({dayOfWeek}) {slotInfo.label}반
                </h2>
                <p className="text-sm text-muted-foreground">학생 {students.length}명</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/50"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 강사 출결 섹션 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">강사 출결</h3>
                </div>

                {instructors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">등록된 강사가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {instructors.map((instructor) => {
                      const isHourly = instructor.salary_type === 'hourly';
                      const attendance = instructorAttendances[instructor.id];

                      return (
                        <div
                          key={instructor.id}
                          className="p-3 bg-muted rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                <UserCog className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <span className="font-medium text-foreground">{instructor.name}</span>
                                {isHourly && (
                                  <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">시급</span>
                                )}
                              </div>
                            </div>

                            {/* 시급 강사: 출근/퇴근 버튼 */}
                            {isHourly ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    const currentTime = getCurrentTime();
                                    setInstructorAttendances(prev => ({
                                      ...prev,
                                      [instructor.id]: {
                                        ...prev[instructor.id],
                                        status: 'present',
                                        checkIn: currentTime
                                      },
                                    }));
                                    try {
                                      setSavingInstructor(true);
                                      await apiClient.post(`/schedules/date/${date}/instructor-attendance`, {
                                        attendances: [{
                                          instructor_id: instructor.id,
                                          time_slot: timeSlot,
                                          attendance_status: 'present',
                                          check_in_time: currentTime,
                                          check_out_time: attendance?.checkOut || null,
                                        }],
                                      });
                                    } catch (err) {
                                      console.error('Failed to check in:', err);
                                      loadInstructorAttendance();
                                    } finally {
                                      setSavingInstructor(false);
                                    }
                                  }}
                                  disabled={savingInstructor}
                                  className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                                    attendance?.checkIn
                                      ? 'bg-green-500 text-white'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  )}
                                >
                                  {attendance?.checkIn ? `출근 ${attendance.checkIn}` : '출근'}
                                </button>
                                <button
                                  onClick={async () => {
                                    const currentTime = getCurrentTime();
                                    setInstructorAttendances(prev => ({
                                      ...prev,
                                      [instructor.id]: {
                                        ...prev[instructor.id],
                                        status: 'present',
                                        checkOut: currentTime
                                      },
                                    }));
                                    try {
                                      setSavingInstructor(true);
                                      await apiClient.post(`/schedules/date/${date}/instructor-attendance`, {
                                        attendances: [{
                                          instructor_id: instructor.id,
                                          time_slot: timeSlot,
                                          attendance_status: 'present',
                                          check_in_time: attendance?.checkIn || null,
                                          check_out_time: currentTime,
                                        }],
                                      });
                                    } catch (err) {
                                      console.error('Failed to check out:', err);
                                      loadInstructorAttendance();
                                    } finally {
                                      setSavingInstructor(false);
                                    }
                                  }}
                                  disabled={savingInstructor || !attendance?.checkIn}
                                  className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                                    attendance?.checkOut
                                      ? 'bg-blue-500 text-white'
                                      : attendance?.checkIn
                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  )}
                                >
                                  {attendance?.checkOut ? `퇴근 ${attendance.checkOut}` : '퇴근'}
                                </button>
                                <button
                                  onClick={() => handleInstructorAttendance(instructor.id, 'absent')}
                                  disabled={savingInstructor}
                                  className={cn(
                                    'px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                                    attendance?.status === 'absent'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                  )}
                                >
                                  결근
                                </button>
                              </div>
                            ) : (
                              /* 비시급 강사: 기존 출결 버튼들 */
                              <div className="flex items-center gap-1">
                                {INSTRUCTOR_ATTENDANCE_STATUS.map((status) => {
                                  const isSelected = attendance?.status === status.value;
                                  return (
                                    <button
                                      key={status.value}
                                      onClick={() => handleInstructorAttendance(instructor.id, status.value)}
                                      disabled={savingInstructor}
                                      className={cn(
                                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                        isSelected
                                          ? `${status.color} text-white`
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      )}
                                    >
                                      {status.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 시급 강사: 시간 수정 (클릭하면 수정 가능) */}
                          {isHourly && (attendance?.checkIn || attendance?.checkOut) && (
                            <div className="flex items-center gap-2 pl-11">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                value={attendance?.checkIn || ''}
                                onChange={(e) => handleTimeChange(instructor.id, 'checkIn', e.target.value)}
                                onBlur={() => saveInstructorTime(instructor.id)}
                                className="w-28 h-8 text-sm"
                                placeholder="출근"
                              />
                              <span className="text-gray-400">~</span>
                              <Input
                                type="time"
                                value={attendance?.checkOut || ''}
                                onChange={(e) => handleTimeChange(instructor.id, 'checkOut', e.target.value)}
                                onBlur={() => saveInstructorTime(instructor.id)}
                                className="w-28 h-8 text-sm"
                                placeholder="퇴근"
                              />
                              {attendance?.checkIn && attendance?.checkOut && (
                                <span className="text-xs text-green-600 font-medium">
                                  {calculateHours(attendance.checkIn, attendance.checkOut)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t border-border" />

              {/* 학생 목록 섹션 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">학생 출결</h3>
                  <Badge variant="secondary">{students.length}명</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setShowAddStudent(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    보충 추가
                  </Button>
                </div>

                {/* 보충 학생 검색 */}
                {showAddStudent && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">보충 학생 검색</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 w-6 p-0"
                        onClick={() => {
                          setShowAddStudent(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="학생 이름 검색..."
                      value={searchQuery}
                      onChange={(e) => handleSearchStudent(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    {isSearching && (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {searchResults.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => handleAddMakeupStudent(student.id, student.name)}
                            disabled={isAddingStudent}
                            className="w-full flex items-center justify-between p-2 text-left text-sm bg-card rounded hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                          >
                            <span>{student.name}</span>
                            <span className="text-xs text-muted-foreground">{student.grade}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchQuery.length > 0 && !isSearching && searchResults.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">검색 결과가 없습니다</p>
                    )}
                  </div>
                )}

                {students.length === 0 ? (
                  <div className="py-8 text-center">
                    <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground text-sm">배정된 학생이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 시즌 배정 학생 먼저 정렬 */}
                    {[...students]
                      .sort((a, b) => {
                        // 시즌 배정 학생 먼저
                        if (a.season_type && !b.season_type) return -1;
                        if (!a.season_type && b.season_type) return 1;
                        return 0;
                      })
                      .map((student) => {
                        const currentStatus = studentAttendances[student.student_id] || '';
                        const isSaving = savingStudent === student.student_id;

                        return (
                          <div
                            key={student.student_id}
                            className="group p-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{student.student_name}</span>
                                  {student.grade && (
                                    <span className="text-xs text-muted-foreground">{student.grade}</span>
                                  )}
                                  {!!student.is_trial && (
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      체험 {(2 - (student.trial_remaining ?? 2)) + 1}/2
                                    </Badge>
                                  )}
                                  {student.season_type && (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                      시즌
                                    </Badge>
                                  )}
                                  {!!student.is_makeup && (
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                                      보충
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* 슬롯 이동 버튼 */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {OTHER_SLOTS[timeSlot].map((otherSlot) => {
                                  const otherInfo = TIME_SLOT_INFO[otherSlot];
                                  const OtherIcon = otherInfo.icon;
                                  return (
                                    <Button
                                      key={otherSlot}
                                      size="sm"
                                      variant="ghost"
                                      className={cn('h-7 px-2', otherInfo.color)}
                                      disabled={movingStudent === student.student_id}
                                      onClick={() => handleMoveStudent(student.student_id, otherSlot)}
                                      title={`${otherInfo.label}으로 이동`}
                                    >
                                      <OtherIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 출결 상태 버튼 */}
                            <div className="flex items-center gap-1 pl-11">
                              {STUDENT_ATTENDANCE_STATUS.map((status) => {
                                const isSelected = currentStatus === status.value;
                                return (
                                  <button
                                    key={status.value}
                                    onClick={() => handleStudentAttendance(student.student_id, status.value)}
                                    disabled={isSaving}
                                    className={cn(
                                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                                      isSelected
                                        ? `${status.color} text-white`
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    )}
                                  >
                                    {status.label}
                                  </button>
                                );
                              })}
                              {isSaving && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
