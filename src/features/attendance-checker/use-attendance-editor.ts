import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Attendance, AttendanceStatus, AttendanceSubmission } from '@/lib/types/schedule';
import { calculateAttendanceStats } from '@/lib/utils/schedule-helpers';
import {
  addAttendanceMakeupStudent,
  searchAttendanceStudents,
} from './attendance-checker-api';
import {
  buildAttendanceSubmissions,
  createEditedAttendanceMap,
  hasEditedAttendanceChanges,
} from './attendance-checker-utils';
import type {
  AttendanceSearchStudent,
  EditedAttendanceData,
  ReasonModalData,
} from './attendance-checker-types';

interface UseAttendanceEditorOptions {
  attendances: Attendance[];
  onSubmit: (submissions: AttendanceSubmission[]) => void;
  currentDate?: string;
  timeSlot?: string;
  onStudentAdded?: () => void;
}

export function useAttendanceEditor({
  attendances,
  onSubmit,
  currentDate,
  timeSlot,
  onStudentAdded,
}: UseAttendanceEditorOptions) {
  const [editedAttendances, setEditedAttendances] = useState(() => createEditedAttendanceMap(attendances));
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AttendanceSearchStudent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [reasonModalData, setReasonModalData] = useState<ReasonModalData | null>(null);

  useEffect(() => {
    setEditedAttendances(createEditedAttendanceMap(attendances));
  }, [attendances]);

  const stats = useMemo(() => {
    return calculateAttendanceStats(
      attendances.map((attendance) => ({
        ...attendance,
        attendance_status:
          editedAttendances.get(attendance.student_id)?.status || attendance.attendance_status,
      }))
    );
  }, [attendances, editedAttendances]);

  const hasChanges = useMemo(() => {
    return hasEditedAttendanceChanges(attendances, editedAttendances);
  }, [attendances, editedAttendances]);

  const handleStatusChange = (
    studentId: number,
    status: AttendanceStatus | null,
    studentName?: string
  ) => {
    const current = editedAttendances.get(studentId);
    const currentStatus = current?.status || null;

    if (status !== null && status === currentStatus) {
      setEditedAttendances((prev) => {
        const newMap = new Map(prev);
        newMap.set(studentId, { status: null, makeup_date: undefined, notes: undefined });
        return newMap;
      });
      return;
    }

    if ((status === 'absent' || status === 'excused') && studentName) {
      setReasonModalData({
        studentId,
        studentName,
        status,
        reason: '',
        customReason: '',
      });
      return;
    }

    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const currentData = newMap.get(studentId) || { status: null };
      const nextData: EditedAttendanceData = { ...currentData, status };

      if (status !== 'makeup') nextData.makeup_date = undefined;
      if (status !== 'absent' && status !== 'excused') nextData.notes = undefined;

      newMap.set(studentId, nextData);
      return newMap;
    });
  };

  const handleReasonConfirm = () => {
    if (!reasonModalData) return;

    const { studentId, status, reason, customReason } = reasonModalData;
    const finalNotes = reason === '기타' ? customReason.trim() : reason;

    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const currentData = newMap.get(studentId) || { status: null };
      newMap.set(studentId, {
        ...currentData,
        status,
        notes: finalNotes,
        makeup_date: undefined,
      });
      return newMap;
    });

    setReasonModalData(null);
  };

  const handleMakeupDateChange = (studentId: number, makeupDate: string) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const currentData = newMap.get(studentId) || { status: 'makeup' };
      newMap.set(studentId, { ...currentData, makeup_date: makeupDate });
      return newMap;
    });
  };

  const handleNotesChange = (studentId: number, notes: string) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const currentData = newMap.get(studentId) || { status: null };
      newMap.set(studentId, { ...currentData, notes });
      return newMap;
    });
  };

  const handleSubmit = () => {
    const { submissions, missingMakeupDate } = buildAttendanceSubmissions(attendances, editedAttendances);

    if (missingMakeupDate) {
      toast.error('보충으로 설정된 학생의 보충 날짜를 선택해주세요.');
      return;
    }

    onSubmit(submissions);
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const students = await searchAttendanceStudents(query);
      const existingIds = new Set(attendances.map((attendance) => attendance.student_id));
      setSearchResults(students.filter((student) => !existingIds.has(student.id)));
    } catch {
      console.error('Attendance student search failed');
      toast.error('학생 검색을 완료하지 못했습니다. 이름을 다시 확인해주세요.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMakeupStudent = async (studentId: number, studentName: string) => {
    if (!currentDate || !timeSlot) {
      toast.error('수업 정보를 확인하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.');
      return;
    }

    setIsAddingStudent(true);
    try {
      await addAttendanceMakeupStudent(currentDate, timeSlot, studentId);
      toast.success(`${studentName} 학생이 보충으로 추가되었습니다.`);
      closeAddStudentModal();
      onStudentAdded?.();
    } catch {
      console.error('Attendance makeup student add failed');
      toast.error('보충 학생을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const closeAddStudentModal = () => {
    setShowAddStudentModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return {
    editedAttendances,
    stats,
    hasChanges,
    showAddStudentModal,
    searchQuery,
    searchResults,
    isSearching,
    isAddingStudent,
    reasonModalData,
    setShowAddStudentModal,
    setSearchQuery,
    setReasonModalData,
    closeAddStudentModal,
    handleStatusChange,
    handleReasonConfirm,
    handleMakeupDateChange,
    handleNotesChange,
    handleSubmit,
    handleSearch,
    handleAddMakeupStudent,
  };
}
