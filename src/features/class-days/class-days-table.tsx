'use client';

import { AlertCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { WEEKDAY_MAP, WEEKDAY_OPTIONS } from '@/lib/types/student';
import type { ClassDaysStudent } from '@/lib/types/student';
import { extractDayNumbers, formatClassDaysWithSlots, parseClassDaysWithSlots } from '@/lib/utils/student-helpers';
import { cn } from '@/lib/utils';
import type { StudentEdit, TimeSlot } from './class-days-types';

interface ClassDaysTableProps {
  students: ClassDaysStudent[];
  selectedIds: Set<number>;
  edits: Map<number, StudentEdit>;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onToggleDay: (studentId: number, dayValue: number) => void;
  onChangeDayTimeSlot: (studentId: number, dayValue: number, timeSlot: TimeSlot) => void;
  onResetEdit: (studentId: number) => void;
  onCancelSchedule: (studentId: number) => void;
}

export function ClassDaysTable({
  students,
  selectedIds,
  edits,
  onToggleSelectAll,
  onToggleSelect,
  onToggleDay,
  onChangeDayTimeSlot,
  onResetEdit,
  onCancelSchedule,
}: ClassDaysTableProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="p-0">
        <div className="space-y-3 p-3 lg:hidden">
          {students.map((student) => (
            <ClassDaysMobileCard
              key={student.id}
              student={student}
              selected={selectedIds.has(student.id)}
              edit={edits.get(student.id)}
              onToggleSelect={onToggleSelect}
              onToggleDay={onToggleDay}
              onChangeDayTimeSlot={onChangeDayTimeSlot}
              onResetEdit={onResetEdit}
              onCancelSchedule={onCancelSchedule}
            />
          ))}
          {students.length === 0 ? <ClassDaysEmptyState /> : null}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b bg-muted/60">
                <th className="w-10 p-3 text-left">
                  <Checkbox
                    aria-label="전체 학생 선택"
                    checked={selectedIds.size === students.length && students.length > 0}
                    onCheckedChange={onToggleSelectAll}
                  />
                </th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">이름</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">학년</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">현재 수업일</th>
                <th className="p-3 text-center text-xs font-semibold uppercase tracking-normal text-muted-foreground">수업일 변경</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">변경 예정</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <ClassDaysRow
                  key={student.id}
                  student={student}
                  selected={selectedIds.has(student.id)}
                  edit={edits.get(student.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleDay={onToggleDay}
                  onChangeDayTimeSlot={onChangeDayTimeSlot}
                  onResetEdit={onResetEdit}
                  onCancelSchedule={onCancelSchedule}
                />
              ))}
              {students.length === 0 ? <ClassDaysEmptyTableRow /> : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassDaysEmptyState() {
  return (
    <div className="rounded-md border border-border bg-background p-8 text-center text-muted-foreground">
      <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
      표시할 학생이 없습니다.
    </div>
  );
}

function ClassDaysEmptyTableRow() {
  return (
    <tr>
      <td colSpan={6} className="p-8 text-center text-muted-foreground">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
        표시할 학생이 없습니다.
      </td>
    </tr>
  );
}

interface ClassDaysRowProps {
  student: ClassDaysStudent;
  selected: boolean;
  edit: StudentEdit | undefined;
  onToggleSelect: (id: number) => void;
  onToggleDay: (studentId: number, dayValue: number) => void;
  onChangeDayTimeSlot: (studentId: number, dayValue: number, timeSlot: TimeSlot) => void;
  onResetEdit: (studentId: number) => void;
  onCancelSchedule: (studentId: number) => void;
}

function ClassDaysMobileCard({
  student,
  selected,
  edit,
  onToggleSelect,
  onToggleDay,
  onChangeDayTimeSlot,
  onResetEdit,
  onCancelSchedule,
}: ClassDaysRowProps) {
  const defaultTimeSlot = student.time_slot || 'evening';
  const currentSlots = edit ? edit.class_days : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
  const currentDayNums = extractDayNumbers(currentSlots);
  const originalDayNums = extractDayNumbers(parseClassDaysWithSlots(student.class_days, defaultTimeSlot));
  const hasChange = !!edit?.changed;
  const hasScheduled = student.class_days_next !== null;

  return (
    <article className={cn('rounded-md border border-border bg-background p-4', hasChange && 'border-blue-300 bg-blue-50/45')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            aria-label={`${student.name} 선택`}
            checked={selected}
            onCheckedChange={() => onToggleSelect(student.id)}
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{student.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{student.grade || '-'}</Badge>
              <span>{formatClassDaysWithSlots(student.class_days, defaultTimeSlot)} (주{student.weekly_count}회)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <ClassDayEditor
          student={student}
          currentSlots={currentSlots}
          currentDayNums={currentDayNums}
          originalDayNums={originalDayNums}
          hasChange={hasChange}
          onToggleDay={onToggleDay}
          onChangeDayTimeSlot={onChangeDayTimeSlot}
          onResetEdit={onResetEdit}
        />
      </div>
      <div className="mt-4 border-t border-border/70 pt-3">
        <ScheduleStatus
          student={student}
          currentSlots={currentSlots}
          defaultTimeSlot={defaultTimeSlot}
          hasChange={hasChange}
          hasScheduled={hasScheduled}
          onCancelSchedule={onCancelSchedule}
        />
      </div>
    </article>
  );
}

function ClassDaysRow({
  student,
  selected,
  edit,
  onToggleSelect,
  onToggleDay,
  onChangeDayTimeSlot,
  onResetEdit,
  onCancelSchedule,
}: ClassDaysRowProps) {
  const defaultTimeSlot = student.time_slot || 'evening';
  const currentSlots = edit ? edit.class_days : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
  const currentDayNums = extractDayNumbers(currentSlots);
  const originalDayNums = extractDayNumbers(parseClassDaysWithSlots(student.class_days, defaultTimeSlot));
  const hasChange = edit?.changed;
  const hasScheduled = student.class_days_next !== null;

  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-muted/30',
        hasChange && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
    >
      <td className="p-3">
        <Checkbox
          aria-label={`${student.name} 선택`}
          checked={selected}
          onCheckedChange={() => onToggleSelect(student.id)}
        />
      </td>
      <td className="p-3">
        <span className="font-medium">{student.name}</span>
      </td>
      <td className="p-3">
        <Badge variant="outline">{student.grade || '-'}</Badge>
      </td>
      <td className="p-3">
        <span className="text-sm">
          {formatClassDaysWithSlots(student.class_days, defaultTimeSlot)} (주{student.weekly_count}회)
        </span>
      </td>
      <td className="p-3">
        <ClassDayEditor
          student={student}
          currentSlots={currentSlots}
          currentDayNums={currentDayNums}
          originalDayNums={originalDayNums}
          hasChange={!!hasChange}
          onToggleDay={onToggleDay}
          onChangeDayTimeSlot={onChangeDayTimeSlot}
          onResetEdit={onResetEdit}
        />
      </td>
      <td className="p-3">
        <ScheduleStatus
          student={student}
          currentSlots={currentSlots}
          defaultTimeSlot={defaultTimeSlot}
          hasChange={!!hasChange}
          hasScheduled={hasScheduled}
          onCancelSchedule={onCancelSchedule}
        />
      </td>
    </tr>
  );
}

function ClassDayEditor({
  student,
  currentSlots,
  currentDayNums,
  originalDayNums,
  hasChange,
  onToggleDay,
  onChangeDayTimeSlot,
  onResetEdit,
}: {
  student: ClassDaysStudent;
  currentSlots: ReturnType<typeof parseClassDaysWithSlots>;
  currentDayNums: number[];
  originalDayNums: number[];
  hasChange: boolean;
  onToggleDay: (studentId: number, dayValue: number) => void;
  onChangeDayTimeSlot: (studentId: number, dayValue: number, timeSlot: TimeSlot) => void;
  onResetEdit: (studentId: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-center gap-1">
        {WEEKDAY_OPTIONS.map((option) => {
          const isActive = currentDayNums.includes(option.value);
          const wasOriginal = originalDayNums.includes(option.value);
          const isChanged = isActive !== wasOriginal;

          return (
            <button
              type="button"
              key={option.value}
              aria-label={`${student.name} ${option.label}요일 선택`}
              aria-pressed={isActive}
              onClick={() => onToggleDay(student.id, option.value)}
              className={cn(
                'h-9 w-9 rounded-md border text-xs font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:border-primary/50',
                isChanged && isActive && 'ring-2 ring-blue-400',
                isChanged && !isActive && 'ring-2 ring-red-300 border-red-300'
              )}
            >
              {option.label}
            </button>
          );
        })}
        {hasChange && (
          <button
            type="button"
            aria-label={`${student.name} 변경 취소`}
            onClick={() => onResetEdit(student.id)}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title="변경 취소"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {currentSlots.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-1">
          {[...currentSlots].sort(sortSlotsMondayFirst).map((slot) => (
            <select
              key={slot.day}
              aria-label={`${student.name} ${WEEKDAY_MAP[slot.day]}요일 시간대`}
              value={slot.timeSlot}
              onChange={(event) => onChangeDayTimeSlot(student.id, slot.day, event.target.value as TimeSlot)}
              className="min-w-[74px] rounded border border-input bg-background px-2 py-1 text-xs"
              title={`${WEEKDAY_MAP[slot.day]} 시간대`}
            >
              <option value="morning">{WEEKDAY_MAP[slot.day]} 오전</option>
              <option value="afternoon">{WEEKDAY_MAP[slot.day]} 오후</option>
              <option value="evening">{WEEKDAY_MAP[slot.day]} 저녁</option>
            </select>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleStatus({
  student,
  currentSlots,
  defaultTimeSlot,
  hasChange,
  hasScheduled,
  onCancelSchedule,
}: {
  student: ClassDaysStudent;
  currentSlots: ReturnType<typeof parseClassDaysWithSlots>;
  defaultTimeSlot: TimeSlot;
  hasChange: boolean;
  hasScheduled: boolean;
  onCancelSchedule: (studentId: number) => void;
}) {
  if (hasScheduled) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm">
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            {formatClassDaysWithSlots(student.class_days_next, defaultTimeSlot)}
          </Badge>
          <span className="ml-1 text-xs text-muted-foreground">
            ({student.class_days_effective_from?.slice(0, 7)}~)
          </span>
        </div>
        <button
          type="button"
          aria-label={`${student.name} 예약 변경 취소`}
          onClick={() => onCancelSchedule(student.id)}
          className="text-red-500 hover:text-red-700"
          title="예약 취소"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (hasChange) {
    return (
      <Badge variant="secondary" className="text-blue-600">
        {formatClassDaysWithSlots(currentSlots)} (주{currentSlots.length}회)
      </Badge>
    );
  }

  return <span className="text-sm text-muted-foreground">-</span>;
}

function sortSlotsMondayFirst(a: { day: number }, b: { day: number }) {
  return (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day);
}
