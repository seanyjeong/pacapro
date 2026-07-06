import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAttendanceRealtime, useInstructorAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import type { TimeSlot } from '@/lib/types/schedule';
import {
  addMakeupStudent,
  getInstructorAttendance,
  getSlotData,
  moveSlotStudent,
  saveInstructorAttendance,
  saveStudentAttendance,
  searchActiveStudents,
} from './time-slot-detail-api';
import {
  buildInstructorAttendanceMap,
  buildStudentAttendanceMap,
  getCurrentTime,
} from './time-slot-detail-utils';
import type {
  AbsenceStatus,
  AttendanceStudent,
  Instructor,
  InstructorAttendanceState,
  InstructorClockField,
  ReasonInputState,
  SearchStudent,
  StudentAttendanceState,
} from './time-slot-detail-types';

interface UseTimeSlotDetailStateOptions {
  open: boolean;
  date: string | null;
  timeSlot: TimeSlot | null;
  onStudentMoved?: () => void;
}

interface LoadSlotDataOptions {
  background?: boolean;
}

export function useTimeSlotDetailState({
  open,
  date,
  timeSlot,
  onStudentMoved,
}: UseTimeSlotDetailStateOptions) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorAttendances, setInstructorAttendances] = useState<Record<number, InstructorAttendanceState>>({});
  const [studentAttendances, setStudentAttendances] = useState<Record<number, StudentAttendanceState>>({});
  const [savingInstructor, setSavingInstructor] = useState(false);
  const [savingStudent, setSavingStudent] = useState<number | null>(null);
  const [movingStudent, setMovingStudent] = useState<number | null>(null);
  const [reasonInput, setReasonInput] = useState<ReasonInputState | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const loadSlotData = useCallback(async ({ background = false }: LoadSlotDataOptions = {}) => {
    if (!date || !timeSlot) return;

    try {
      if (!background) setLoading(true);
      const response = await getSlotData(date, timeSlot);
      const studentList = response.schedule?.students || [];
      setStudents(studentList);
      setScheduleId(response.schedule?.id || null);
      setStudentAttendances(buildStudentAttendanceMap(studentList));
    } catch {
      if (!background) {
        console.error('Failed to load slot data');
        toast.error('시간대 학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [date, timeSlot]);

  const loadInstructorAttendance = useCallback(async () => {
    if (!date || !timeSlot) return;

    try {
      const response = await getInstructorAttendance(date);
      setInstructors(response.instructors_by_slot?.[timeSlot] || []);
      setInstructorAttendances(buildInstructorAttendanceMap(response.attendances, timeSlot));
    } catch {
      console.error('Failed to load instructor attendance');
      toast.error('강사 출결 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [date, timeSlot]);

  useEffect(() => {
    if (open && date && timeSlot) {
      void loadSlotData();
      void loadInstructorAttendance();
      return;
    }

    if (!open) {
      setReasonInput(null);
      setShowAddStudent(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [date, loadInstructorAttendance, loadSlotData, open, timeSlot]);

  useAttendanceRealtime({
    scheduleId,
    enabled: open && Boolean(scheduleId),
    onAttendanceUpdated: () => {
      void loadSlotData({ background: true });
    },
  });

  useInstructorAttendanceRealtime({
    date,
    timeSlot,
    enabled: open && Boolean(date && timeSlot),
    onInstructorAttendanceUpdated: () => {
      void loadInstructorAttendance();
    },
  });

  const persistInstructor = useCallback(async (
    instructorId: number,
    next: InstructorAttendanceState
  ) => {
    if (!date || !timeSlot) return;

    await saveInstructorAttendance(date, [{
      instructor_id: instructorId,
      time_slot: timeSlot,
      attendance_status: next.status || 'none',
      check_in_time: next.checkIn || null,
      check_out_time: next.checkOut || null,
    }]);
  }, [date, timeSlot]);

  const handleInstructorStatus = useCallback(async (instructorId: number, status: string) => {
    const current = instructorAttendances[instructorId];
    const nextStatus = current?.status === status ? '' : status;
    const next = { ...current, status: nextStatus };

    setInstructorAttendances((prev) => ({ ...prev, [instructorId]: next }));

    try {
      setSavingInstructor(true);
      await persistInstructor(instructorId, next);
    } catch {
      console.error('Failed to save instructor attendance');
      toast.error('강사 출결을 저장하지 못했습니다. 다시 확인해주세요.');
      void loadInstructorAttendance();
    } finally {
      setSavingInstructor(false);
    }
  }, [instructorAttendances, loadInstructorAttendance, persistInstructor]);

  const handleInstructorTimeChange = useCallback((
    instructorId: number,
    field: InstructorClockField,
    value: string
  ) => {
    const current = instructorAttendances[instructorId] || { status: 'present', checkIn: '', checkOut: '' };
    setInstructorAttendances((prev) => ({
      ...prev,
      [instructorId]: { ...current, [field]: value },
    }));
  }, [instructorAttendances]);

  const saveInstructorTime = useCallback(async (instructorId: number) => {
    const current = instructorAttendances[instructorId];
    if (!current) return;

    try {
      setSavingInstructor(true);
      await persistInstructor(instructorId, { ...current, status: current.status || 'present' });
    } catch {
      console.error('Failed to save instructor time');
      toast.error('강사 근무 시간을 저장하지 못했습니다. 다시 확인해주세요.');
      void loadInstructorAttendance();
    } finally {
      setSavingInstructor(false);
    }
  }, [instructorAttendances, loadInstructorAttendance, persistInstructor]);

  const clockInstructor = useCallback(async (instructorId: number, field: InstructorClockField) => {
    const current = instructorAttendances[instructorId] || { status: 'present', checkIn: '', checkOut: '' };
    const currentTime = getCurrentTime();
    const next = { ...current, status: 'present', [field]: currentTime };

    setInstructorAttendances((prev) => ({ ...prev, [instructorId]: next }));

    try {
      setSavingInstructor(true);
      await persistInstructor(instructorId, next);
    } catch {
      console.error(`Failed to save instructor ${field}`);
      toast.error('강사 출퇴근 시간을 저장하지 못했습니다. 다시 확인해주세요.');
      void loadInstructorAttendance();
    } finally {
      setSavingInstructor(false);
    }
  }, [instructorAttendances, loadInstructorAttendance, persistInstructor]);

  const handleMoveStudent = useCallback(async (studentId: number, toSlot: TimeSlot) => {
    if (!date || !timeSlot) return;

    try {
      setMovingStudent(studentId);
      await moveSlotStudent(date, timeSlot, toSlot, studentId);
      await loadSlotData();
      onStudentMoved?.();
    } catch {
      console.error('Failed to move student');
      toast.error('학생 시간대를 이동하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setMovingStudent(null);
    }
  }, [date, loadSlotData, onStudentMoved, timeSlot]);

  const handleStudentAttendance = useCallback(async (
    studentId: number,
    status: string,
    notes?: string
  ) => {
    if (!scheduleId) return;

    const currentData = studentAttendances[studentId];
    const isTogglingOff = currentData?.status === status;

    if ((status === 'absent' || status === 'excused') && !notes && !isTogglingOff) {
      setReasonInput({
        studentId,
        status: status as AbsenceStatus,
        reason: '',
        customReason: '',
      });
      return;
    }

    const nextStatus = isTogglingOff ? '' : status;
    const nextNotes = nextStatus ? notes : undefined;

    setStudentAttendances((prev) => ({
      ...prev,
      [studentId]: { status: nextStatus, notes: nextNotes },
    }));

    try {
      setSavingStudent(studentId);
      await saveStudentAttendance(scheduleId, [{
        student_id: studentId,
        attendance_status: nextStatus || 'none',
        notes: nextNotes || null,
      }]);
    } catch {
      console.error('Failed to save student attendance');
      toast.error('학생 출결을 저장하지 못했습니다. 다시 확인해주세요.');
      setStudentAttendances((prev) => ({
        ...prev,
        [studentId]: currentData || { status: '' },
      }));
    } finally {
      setSavingStudent(null);
    }
  }, [scheduleId, studentAttendances]);

  const handleReasonConfirm = useCallback(() => {
    if (!reasonInput) return;

    const { studentId, status, reason, customReason } = reasonInput;
    const finalNotes = reason === '기타' ? customReason.trim() : reason;
    void handleStudentAttendance(studentId, status, finalNotes);
    setReasonInput(null);
  }, [handleStudentAttendance, reasonInput]);

  const handleSearchStudent = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await searchActiveStudents(query);
      const existingIds = new Set(students.map((student) => student.student_id));
      setSearchResults(response.filter((student) => !existingIds.has(student.id)));
    } catch {
      console.error('Failed to search students');
      toast.error('학생 검색을 완료하지 못했습니다. 이름을 다시 확인해주세요.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [students]);

  const handleAddMakeupStudent = useCallback(async (studentId: number, studentName: string) => {
    if (!date || !timeSlot) return;

    try {
      setIsAddingStudent(true);
      await addMakeupStudent(date, timeSlot, studentId);
      toast.success(`${studentName} 학생이 보충으로 추가되었습니다.`);
      setShowAddStudent(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadSlotData();
      onStudentMoved?.();
    } catch {
      console.error('Failed to add makeup student');
      toast.error('보충 학생을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAddingStudent(false);
    }
  }, [date, loadSlotData, onStudentMoved, timeSlot]);

  const closeMakeupSearch = useCallback(() => {
    setShowAddStudent(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    loading,
    students,
    instructors,
    instructorAttendances,
    studentAttendances,
    savingInstructor,
    savingStudent,
    movingStudent,
    reasonInput,
    showAddStudent,
    searchQuery,
    searchResults,
    isSearching,
    isAddingStudent,
    setReasonInput,
    setShowAddStudent,
    closeMakeupSearch,
    handleInstructorStatus,
    handleInstructorTimeChange,
    saveInstructorTime,
    clockInstructor,
    handleMoveStudent,
    handleStudentAttendance,
    handleReasonConfirm,
    handleReasonCancel: () => setReasonInput(null),
    handleSearchStudent,
    handleAddMakeupStudent,
  };
}
