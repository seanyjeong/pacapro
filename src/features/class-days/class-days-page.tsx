'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { studentsAPI } from '@/lib/api/students';
import type { ClassDaysStudent, ClassDaySlot } from '@/lib/types/student';
import { extractDayNumbers, parseClassDaysWithSlots } from '@/lib/utils/student-helpers';
import { ClassDaysBulkEditor } from './class-days-bulk-editor';
import { ClassDaysControlBar } from './class-days-control-bar';
import { ClassDaysError } from './class-days-error';
import { ClassDaysFilters } from './class-days-filters';
import { ClassDaysHeader } from './class-days-header';
import { ClassDaysLoading } from './class-days-loading';
import { ClassDaysOperationsBoard } from './class-days-operations-board';
import { ClassDaysSaveError } from './class-days-save-error';
import { ClassDaysTable } from './class-days-table';
import type { StudentEdit, TimeSlot } from './class-days-types';
import { filterAndSortClassDaysStudents, getEffectiveMonthOptions } from './class-days-utils';

export function ClassDaysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<ClassDaysStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('immediate');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Map<number, StudentEdit>>(new Map());
  const [bulkSlots, setBulkSlots] = useState<ClassDaySlot[]>([]);
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterWeekly, setFilterWeekly] = useState('all');
  const [showScheduledOnly, setShowScheduledOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const requestedStudentId = Number.parseInt(searchParams.get('studentId') || '', 10);
  const focusedStudentId = Number.isFinite(requestedStudentId) ? requestedStudentId : null;

  const monthOptions = useMemo(() => getEffectiveMonthOptions(), []);
  const filteredStudents = useMemo(
    () => filterAndSortClassDaysStudents(students, filterGrade, filterWeekly, searchQuery, focusedStudentId, showScheduledOnly),
    [focusedStudentId, students, filterGrade, filterWeekly, searchQuery, showScheduledOnly]
  );
  const focusedStudentName = useMemo(() => {
    if (focusedStudentId === null) return null;
    return students.find((student) => student.id === focusedStudentId)?.name || '선택 학생';
  }, [focusedStudentId, students]);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await studentsAPI.getClassDays({ suppressErrorToast: true });
      setStudents(res.students);
      setEdits(new Map());
      setSelectedIds(
        focusedStudentId !== null && res.students.some((student) => student.id === focusedStudentId)
          ? new Set([focusedStudentId])
          : new Set()
      );
      setLoadError(false);
    } catch {
      console.warn('수업일 목록을 불러오지 못했습니다.');
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [focusedStudentId]);

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
    const nextEdit = buildStudentEdit(student, newSlots);

    setEdits((prev) => {
      const next = new Map(prev);
      if (nextEdit) {
        next.set(student.id, nextEdit);
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

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleBulkDay = (dayValue: number) => {
    setBulkSlots((prev) => {
      if (prev.some((slot) => slot.day === dayValue)) {
        return prev.filter((slot) => slot.day !== dayValue);
      }
      return sortClassDaySlots([...prev, { day: dayValue, timeSlot: 'evening' }]);
    });
  };

  const changeBulkTimeSlot = (dayValue: number, timeSlot: TimeSlot) => {
    setBulkSlots((prev) => sortClassDaySlots(prev.map((slot) => (
      slot.day === dayValue ? { ...slot, timeSlot } : slot
    ))));
  };

  const applyBulkPreset = (slots: ClassDaySlot[]) => {
    setBulkSlots(sortClassDaySlots(slots));
  };

  const applyBulkSlotsToSelected = () => {
    const selectedStudents = students.filter((student) => selectedIds.has(student.id));

    if (selectedStudents.length === 0) {
      toast.info('학생을 먼저 선택해주세요.');
      return;
    }

    if (bulkSlots.length === 0) {
      toast.info('적용할 요일을 선택해주세요.');
      return;
    }

    const nextSlots = sortClassDaySlots(bulkSlots);
    setEdits((prev) => {
      const next = new Map(prev);
      selectedStudents.forEach((student) => {
        const nextEdit = buildStudentEdit(student, nextSlots);
        if (nextEdit) {
          next.set(student.id, nextEdit);
        } else {
          next.delete(student.id);
        }
      });
      return next;
    });
    toast.success(`${selectedStudents.length}명에게 수업일 변경을 적용했습니다.`);
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
    setShowScheduledOnly(false);
    setSearchQuery('');
    if (focusedStudentId !== null) {
      router.replace('/students/class-days');
    }
  };

  const changedCount = Array.from(edits.values()).filter((edit) => edit.changed).length;
  const scheduledCount = students.filter((student) => student.class_days_next !== null).length;
  const hasActiveFilters = filterGrade !== 'all' || filterWeekly !== 'all' || searchQuery || focusedStudentId !== null || showScheduledOnly;
  const effectiveFromLabel = monthOptions.find((option) => option.value === effectiveFrom)?.label || '즉시 적용 (이번 달)';

  if (loading) {
    return <ClassDaysLoading />;
  }

  if (loadError) {
    return <ClassDaysError onRetry={fetchStudents} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <ClassDaysHeader totalCount={students.length} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
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
            focusedStudentName={focusedStudentName}
            searchQuery={searchQuery}
            showScheduledOnly={showScheduledOnly}
            resultCount={filteredStudents.length}
            hasActiveFilters={!!hasActiveFilters}
            onGradeChange={setFilterGrade}
            onWeeklyChange={setFilterWeekly}
            onSearchChange={setSearchQuery}
            onReset={resetFilters}
          />
          <ClassDaysBulkEditor
            selectedCount={selectedIds.size}
            slots={bulkSlots}
            onApply={applyBulkSlotsToSelected}
            onChangeTimeSlot={changeBulkTimeSlot}
            onClearSelection={clearSelection}
            onUsePreset={applyBulkPreset}
            onToggleDay={toggleBulkDay}
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
        </main>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <ClassDaysOperationsBoard
            changedCount={changedCount}
            effectiveFromLabel={effectiveFromLabel}
            focusedStudentName={focusedStudentName}
            hasActiveFilters={!!hasActiveFilters}
            resultCount={filteredStudents.length}
            saving={saving}
            scheduledCount={scheduledCount}
            selectedCount={selectedIds.size}
            showScheduledOnly={showScheduledOnly}
            totalCount={students.length}
            onClearSelection={clearSelection}
            onResetFilters={resetFilters}
            onSave={handleSave}
            onToggleScheduledOnly={() => setShowScheduledOnly((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}

function buildStudentEdit(student: ClassDaysStudent, newSlots: ClassDaySlot[]): StudentEdit | null {
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

  return daysChanged || timeSlotsChanged
    ? { class_days: sortClassDaySlots(newSlots), changed: true }
    : null;
}

function sortClassDaySlots(slots: ClassDaySlot[]) {
  return [...slots].sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day));
}
