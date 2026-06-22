'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Filter, Loader2, RefreshCw, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { studentsAPI } from '@/lib/api/students';
import type { ClassDaysStudent, ClassDaySlot } from '@/lib/types/student';
import { extractDayNumbers, parseClassDaysWithSlots } from '@/lib/utils/student-helpers';
import { ClassDaysTable } from './class-days-table';
import type { StudentEdit, TimeSlot } from './class-days-types';
import { filterAndSortClassDaysStudents, getEffectiveMonthOptions } from './class-days-utils';

export function ClassDaysPage() {
  const [students, setStudents] = useState<ClassDaysStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
      toast.error('수업일 변경을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
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
    return (
      <div className="mx-auto flex min-h-[360px] w-full max-w-7xl items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          수업일 목록을 불러오는 중입니다
        </div>
      </div>
    );
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

function ClassDaysHeader({ totalCount }: { totalCount: number }) {
  return (
    <header className="border-b border-border/70 pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Class Days</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업일 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          재원생 {totalCount}명의 수업 요일을 관리합니다.
        </p>
      </div>
    </header>
  );
}

function ClassDaysError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Class Days</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업일 관리</h1>
      </header>
      <section className="flex min-h-[320px] items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-6 text-center text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <div className="max-w-md">
          <AlertCircle className="mx-auto h-10 w-10" />
          <h2 className="mt-4 text-base font-semibold">수업일 목록을 불러오지 못했습니다</h2>
          <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">잠시 후 다시 시도해주세요.</p>
          <Button className="mt-5" type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 불러오기
          </Button>
        </div>
      </section>
    </div>
  );
}

function ClassDaysControlBar({
  effectiveFrom,
  monthOptions,
  changedCount,
  scheduledCount,
  saving,
  onEffectiveFromChange,
  onSave,
}: {
  effectiveFrom: string;
  monthOptions: { value: string; label: string }[];
  changedCount: number;
  scheduledCount: number;
  saving: boolean;
  onEffectiveFromChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="py-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">적용 시작월:</span>
            <Select value={effectiveFrom} onValueChange={onEffectiveFromChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {changedCount > 0 && <Badge variant="secondary">{changedCount}명 변경됨</Badge>}
            {scheduledCount > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                {scheduledCount}명 변경 예정
              </Badge>
            )}
            <Button onClick={onSave} disabled={changedCount === 0 || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              저장 ({changedCount}명)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassDaysFilters({
  filterGrade,
  filterWeekly,
  searchQuery,
  resultCount,
  hasActiveFilters,
  onGradeChange,
  onWeeklyChange,
  onSearchChange,
  onReset,
}: {
  filterGrade: string;
  filterWeekly: string;
  searchQuery: string;
  resultCount: number;
  hasActiveFilters: boolean;
  onGradeChange: (value: string) => void;
  onWeeklyChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterGrade} onValueChange={onGradeChange}>
          <SelectTrigger className="w-[120px] h-8 text-sm">
            <SelectValue placeholder="학년" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 학년</SelectItem>
            <SelectItem value="고1">고1</SelectItem>
            <SelectItem value="고2">고2</SelectItem>
            <SelectItem value="고3">고3</SelectItem>
            <SelectItem value="N수">N수</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterWeekly} onValueChange={onWeeklyChange}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="수업 횟수" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 횟수</SelectItem>
            <SelectItem value="1">주1회</SelectItem>
            <SelectItem value="2">주2회</SelectItem>
            <SelectItem value="3">주3회</SelectItem>
            <SelectItem value="4">주4회</SelectItem>
            <SelectItem value="5">주5회</SelectItem>
            <SelectItem value="6">주6회</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onReset}>
            초기화
          </Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="학생 이름 검색"
          className="h-8 w-[200px] pl-8 text-sm"
        />
      </div>
      <span className="text-sm text-muted-foreground">{resultCount}명</span>
    </section>
  );
}
