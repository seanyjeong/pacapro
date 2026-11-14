/**
 * Student List Table Component
 * 학생 목록 테이블 컴포넌트 - DB 스키마와 일치
 */

'use client';

import { StudentParentNames } from '@/components/students/student-parent-names';
import { useMemo } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { Checkbox } from '@/components/ui/checkbox';
import { StudentAvatar } from '@/components/students/student-avatar';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Loader2,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Student } from '@/lib/types/student';
import type { StudentListSort } from '@/features/students/student-page-types';
import { StudentStatusBadge } from '@/features/students/student-status-badge';
import {
  formatStudentNumber,
  formatPhoneNumber,
  getStudentDisplayInfo,
  formatClassDays,
  formatCurrency,
  formatDate,
} from '@/lib/utils/student-helpers';
import {
  ADMISSION_TYPE_LABELS,
  STUDENT_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/types/student';

const ADMISSION_BADGE: Record<string, NonNullable<BadgeProps['variant']>> = {
  regular: 'default',
  early: 'success',
  advance: 'secondary',
};

interface StudentListTableProps {
  students: Student[];
  loading?: boolean;
  onStudentClick: (id: number) => void;
  hideMonthlyTuition?: boolean;
  sort: StudentListSort | null;
  onSortChange: (key: string) => void;
  // 지점·반을 쓰는 학원만 넘긴다: 지점·반 칸과 여러 명 선택이 생긴다.
  placement?: StudentListPlacement;
}

export interface StudentListPlacement {
  labelOf: (student: Student) => string;
  selectedIds: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: (ids: number[], checked: boolean) => void;
}

const SORT_KEYS = ['name', 'gender', 'type', 'admission', 'classDays', 'tuition', 'status', 'enrollment'] as const;

type SortKey =
  | 'name'
  | 'gender'
  | 'type'
  | 'admission'
  | 'classDays'
  | 'tuition'
  | 'status'
  | 'enrollment';

type SortDir = 'asc' | 'desc';

function isSortKey(value: string | undefined): value is SortKey {
  return SORT_KEYS.some((key) => key === value);
}

// 표 칸을 줄이려고 등록일은 2026.11.14 처럼 짧게(전체 날짜는 마우스를 올리면 보인다).
function formatShortDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function compareText(a: string, b: string): number {
  return (a || '').localeCompare(b || '', 'ko', { sensitivity: 'base', numeric: true });
}

export function compareNumber(a: number, b: number): number {
  return a - b;
}

export function compareDate(a?: string | null, b?: string | null): number {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
}

export function SortHeader<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: K;
  sortKey: K | null;
  sortDir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className={`whitespace-nowrap px-2.5 py-3 text-left text-[13px] font-semibold text-muted-foreground ${className}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-foreground' : 'text-muted-foreground/70'}`} />
      </button>
    </th>
  );
}

export function StudentListTable({ students, loading, onStudentClick, hideMonthlyTuition, sort, onSortChange, placement }: StudentListTableProps) {
  const sortKey = sort && isSortKey(sort.key) ? sort.key : null;
  const sortDir: SortDir = sort?.dir ?? 'asc';
  const handleSort = (key: SortKey) => onSortChange(key);

  const sortedStudents = useMemo(() => {
    if (!sortKey) return students;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...students].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = compareText(a.name || '', b.name || '');
          break;
        case 'gender':
          cmp = compareText(a.gender || '', b.gender || '');
          break;
        case 'type':
          cmp = compareText(
            `${a.student_type || ''}-${getStudentDisplayInfo(a)}`,
            `${b.student_type || ''}-${getStudentDisplayInfo(b)}`
          );
          break;
        case 'admission':
          cmp = compareText(a.admission_type || '', b.admission_type || '');
          break;
        case 'classDays':
          cmp = compareNumber(Number(a.weekly_count) || 0, Number(b.weekly_count) || 0)
            || compareText(formatClassDays(a.class_days), formatClassDays(b.class_days));
          break;
        case 'tuition':
          cmp = compareNumber(Number(a.monthly_tuition) || 0, Number(b.monthly_tuition) || 0);
          break;
        case 'status':
          cmp = compareText(a.status || '', b.status || '');
          break;
        case 'enrollment':
          cmp = compareDate(a.enrollment_date, b.enrollment_date);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
  }, [students, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        학생 목록을 불러오는 중이에요
      </div>
    );
  }

  if (students.length === 0) {
    return <EmptyState icon={Users} title="학생이 없어요" description="학생을 등록하면 여기에 보여요." />;
  }

  const th = 'whitespace-nowrap px-2.5 py-3 text-left text-[13px] font-semibold text-muted-foreground';
  const td = 'whitespace-nowrap px-2.5 py-3.5';

  return (
    <div className="-mx-5 overflow-x-auto px-2 sm:-mx-6 sm:px-3">
      <table className="w-full">
        <thead className="border-b border-border/60">
          <tr>
            {placement && (
              <th className="w-10 px-3 py-3">
                <Checkbox
                  aria-label="보이는 학생 모두 선택"
                  checked={students.every((student) => placement.selectedIds.has(student.id))}
                  onCheckedChange={(checked) => placement.onToggleAll(students.map((student) => student.id), checked === true)}
                />
              </th>
            )}
            <SortHeader label="학생 정보" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            {placement && <th className={th}>지점·반</th>}
            <SortHeader label="성별" column="gender" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="유형" column="type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="입시유형" column="admission" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="수업일" column="classDays" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            {!hideMonthlyTuition && (
              <SortHeader label="월 학원비" column="tuition" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            )}
            <SortHeader label="상태" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <SortHeader label="등록일" column="enrollment" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            <th className={`${th} text-right`}>관리</th>
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((student) => {
            const discountRate = Number.parseFloat(student.discount_rate) || 0;

            return (
              <tr
                key={student.id}
                onClick={() => onStudentClick(student.id)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60"
              >
                {placement && (
                  <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`${student.name} 선택`}
                      checked={placement.selectedIds.has(student.id)}
                      onCheckedChange={() => placement.onToggle(student.id)}
                    />
                  </td>
                )}
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <StudentAvatar student={student} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-foreground">{student.name}</span>
                        {!!student.is_trial && (
                          <Badge>
                            <Sparkles className="h-3 w-3" />
                            체험
                          </Badge>
                        )}
                      </div>
                      <StudentParentNames student={student} className="mt-0.5 max-w-64" />
                      <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                        {student.school && <span>{student.school}</span>}
                        {student.student_number && student.student_number !== '0' && student.student_number !== '00' && (
                          <span className="tabular-nums">{formatStudentNumber(student.student_number)}</span>
                        )}
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(student.phone)}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {placement && (
                  <td className={`${td} text-sm text-foreground`}>{placement.labelOf(student)}</td>
                )}

                <td className={td}>
                  {student.gender ? (
                    <Badge variant="secondary">{GENDER_LABELS[student.gender]}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>

                <td className={td}>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Badge variant={student.student_type === 'exam' ? 'default' : 'secondary'}>
                      {STUDENT_TYPE_LABELS[student.student_type]}
                    </Badge>
                    <span>{getStudentDisplayInfo(student)}</span>
                  </div>
                </td>

                <td className={td}>
                  <Badge variant={ADMISSION_BADGE[student.admission_type] || 'warning'}>
                    {ADMISSION_TYPE_LABELS[student.admission_type] || student.admission_type}
                  </Badge>
                </td>

                <td className={td}>
                  <div className="text-sm text-foreground">
                    {formatClassDays(student.class_days)}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    주 {student.weekly_count}회
                  </div>
                </td>

                {!hideMonthlyTuition && (
                  <td className={td}>
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(student.monthly_tuition)}
                    </div>
                    {discountRate > 0 && (
                      <div className="text-[13px] text-destructive">
                        {discountRate}% 할인
                      </div>
                    )}
                  </td>
                )}

                <td className={td}>
                  <StudentStatusBadge status={student.status} />
                  {student.status === 'paused' && student.rest_start_date && (
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      {formatDate(student.rest_start_date)}
                      {student.rest_end_date
                        ? ` ~ ${formatDate(student.rest_end_date)}`
                        : ' ~ (무기한)'}
                    </div>
                  )}
                </td>

                <td className={`${td} text-sm tabular-nums text-muted-foreground`} title={formatDate(student.enrollment_date)}>
                  {formatShortDate(student.enrollment_date)}
                </td>
                <td className={`${td} text-right`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="상세"
                    aria-label={`${student.name} 상세 보기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onStudentClick(student.id);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
