'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { studentsAPI } from '@/lib/api/students';
import type { ClassDaysStudent, ClassDaySlot } from '@/lib/types/student';
import { extractDayNumbers, parseClassDaysWithSlots } from '@/lib/utils/student-helpers';
import { ClassDaysControlBar } from './class-days-control-bar';
import { ClassDaysError } from './class-days-error';
import { ClassDaysFilters } from './class-days-filters';
import { ClassDaysHeader } from './class-days-header';
import { ClassDaysLoading } from './class-days-loading';
import { ClassDaysSaveError } from './class-days-save-error';
import { ClassDaysTable } from './class-days-table';
import type { StudentEdit, TimeSlot } from './class-days-types';
import { filterAndSortClassDaysStudents, getEffectiveMonthOptions } from './class-days-utils';

export function ClassDaysPage() {
  const [students, setStudents] = useState<ClassDaysStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('immediate');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Map<number, StudentEdit>>(new Map());
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterWeekly, setFilterWeekly] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const monthOptions = useMemo(() => getEffectiveMonthOptions(), []);
  const filteredStudents = useMemo(
    () => filterAndSortClassDaysStudents(students, filterGrade, filterWeekly, searchQuery),
    [students, filterGrade, filterWeekly, searchQuery]
  );

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await studentsAPI.getClassDays({ suppressErrorToast: true });
      setStudents(res.students);
      setEdits(new Map());
      setSelectedIds(new Set());
      setLoadError(false);
    } catch {
      console.warn('수업일 목록을 불러오지 못했습니다.');
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  const toggleDay = (studentId: number, dayValue: number) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    const currentEdit = edits.get(studentId);
    const defaultTimeSlot = student.time_slot || 'evening';
    const currentSlots = currentEdit
      ? currentEdit.class_days
      : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const currentDayNums = extractDayNumbers(currentSlots);

    const newSlots = currentDayNums.includes(dayValue)
      ? currentSlots.filter((slot) => slot.day !== dayValue)
      : [...currentSlots, { day: dayValue, timeSlot: defaultTimeSlot }].sort((a, b) => a.day - b.day);

    updateStudentEdit(student, newSlots);
  };

  const changeDayTimeSlot = (studentId: number, dayValue: number, timeSlot: TimeSlot) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    const currentEdit = edits.get(studentId);
    const defaultTimeSlot = student.time_slot || 'evening';
    const currentSlots = currentEdit
      ? currentEdit.class_days
      : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const newSlots = currentSlots.map((slot) => (slot.day === dayValue ? { ...slot, timeSlot } : slot));

    updateStudentEdit(student, newSlots);
  };

  const updateStudentEdit = (student: ClassDaysStudent, newSlots: ClassDaySlot[]) => {
    const defaultTimeSlot = student.time_slot || 'evening';
    const originalSlots = parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const originalDayNums = new Set(extractDayNumbers(originalSlots));
    const newDayNums = new Set(extractDayNumbers(newSlots));
    const daysChanged = originalDayNums.size !== newDayNums.size ||
      [...originalDayNums].some((day) => !newDayNums.has(day));
    const timeSlotsChanged = !daysChanged && newSlots.some((newSlot) => {
      const originalSlot = originalSlots.find((slot) => slot.day === newSlot.day);
      return originalSlot && originalSlot.timeSlot !== newSlot.timeSlot;
    });

    setEdits((prev) => {
      const next = new Map(prev);
      if (daysChanged || timeSlotsChanged) {
        next.set(student.id, { class_days: newSlots, changed: true });
      } else {
        next.delete(student.id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (
      prev.size === filteredStudents.length
        ? new Set()
        : new Set(filteredStudents.map((student) => student.id))
    ));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetStudentEdit = (studentId: number) => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.delete(studentId);
      return next;
    });
  };

  const handleSave = async () => {
    const changedStudents = Array.from(edits.entries())
      .filter(([, edit]) => edit.changed)
      .map(([id, edit]) => ({ id, class_days: edit.class_days }));

    if (changedStudents.length === 0) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      const effective = effectiveFrom === 'immediate' ? null : effectiveFrom;
      const res = await studentsAPI.bulkUpdateClassDays(
        {
          effective_from: effective,
          students: changedStudents,
        },
        { suppressErrorToast: true }
      );

      toast.success(res.message);
      await fetchStudents();
    } catch {
      console.warn('수업일 변경 저장에 실패했습니다.');
      setSaveError('수업일 변경을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSchedule = async (studentId: number) => {
    try {
      await studentsAPI.cancelClassDaysSchedule(studentId, { suppressErrorToast: true });
      toast.success('예약된 변경이 취소되었습니다.');
      await fetchStudents();
    } catch {
      console.warn('수업일 변경 예약 취소에 실패했습니다.');
      toast.error('예약된 변경을 취소하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const resetFilters = () => {
    setFilterGrade('all');
    setFilterWeekly('all');
    setSearchQuery('');
  };

  const changedCount = Array.from(edits.values()).filter((edit) => edit.changed).length;
  const scheduledCount = students.filter((student) => student.class_days_next !== null).length;
  const hasActiveFilters = filterGrade !== 'all' || filterWeekly !== 'all' || searchQuery;

  if (loading) {
    return <ClassDaysLoading />;
  }

  if (loadError) {
    return <ClassDaysError onRetry={fetchStudents} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <ClassDaysHeader totalCount={students.length} />
      <ClassDaysControlBar
        effectiveFrom={effectiveFrom}
        monthOptions={monthOptions}
        changedCount={changedCount}
        scheduledCount={scheduledCount}
        saving={saving}
        onEffectiveFromChange={setEffectiveFrom}
        onSave={handleSave}
      />
      <ClassDaysSaveError message={saveError} />
      <ClassDaysFilters
        filterGrade={filterGrade}
        filterWeekly={filterWeekly}
        searchQuery={searchQuery}
        resultCount={filteredStudents.length}
        hasActiveFilters={!!hasActiveFilters}
        onGradeChange={setFilterGrade}
        onWeeklyChange={setFilterWeekly}
        onSearchChange={setSearchQuery}
        onReset={resetFilters}
      />
      <ClassDaysTable
        students={filteredStudents}
        selectedIds={selectedIds}
        edits={edits}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        onToggleDay={toggleDay}
        onChangeDayTimeSlot={changeDayTimeSlot}
        onResetEdit={resetStudentEdit}
        onCancelSchedule={handleCancelSchedule}
      />
    </div>
  );
}
