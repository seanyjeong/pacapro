/**
 * Student List Table Component
 * 학생 목록 테이블 컴포넌트 - DB 스키마와 일치
 */

'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentAvatar } from '@/components/students/student-avatar';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Loader2,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Student } from '@/lib/types/student';
import {
  formatStudentNumber,
  formatPhoneNumber,
  getStudentDisplayInfo,
  formatClassDays,
  formatCurrency,
  getStatusColor,
  formatDate,
} from '@/lib/utils/student-helpers';
import {
  ADMISSION_TYPE_LABELS,
  STATUS_LABELS,
  STUDENT_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/types/student';

interface StudentListTableProps {
  students: Student[];
  loading?: boolean;
  onStudentClick: (id: number) => void;
  hideMonthlyTuition?: boolean;
}

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

function compareText(a: string, b: string): number {
  return (a || '').localeCompare(b || '', 'ko', { sensitivity: 'base', numeric: true });
}

function compareNumber(a: number, b: number): number {
  return a - b;
}

function compareDate(a?: string | null, b?: string | null): number {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground ${className}`}
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

export function StudentListTable({ students, loading, onStudentClick, hideMonthlyTuition }: StudentListTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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
      <Card className="rounded-md shadow-none">
        <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
          <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            학생 목록을 불러오는 중입니다
          </div>
        </CardContent>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card className="rounded-md shadow-none">
        <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">학생이 없습니다</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              학생을 등록하시면 여기에 표시됩니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <SortHeader label="학생 정보" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="성별" column="gender" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="유형" column="type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="입시유형" column="admission" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="수업일" column="classDays" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                {!hideMonthlyTuition && (
                  <SortHeader label="월 학원비" column="tuition" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                )}
                <SortHeader label="상태" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="등록일" column="enrollment" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {sortedStudents.map((student) => {
                const discountRate = Number.parseFloat(student.discount_rate) || 0;

                return (
                  <tr
                    key={student.id}
                    onClick={() => onStudentClick(student.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/45"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center">
                        <StudentAvatar student={student} />
                        <div className="ml-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            {student.name}
                            {student.school && (
                              <span className="text-xs text-muted-foreground">{student.school}</span>
                            )}
                            {!!student.is_trial && (
                              <Badge className="flex items-center gap-1 rounded-md border-purple-200 bg-purple-100 px-1.5 py-0 text-xs text-purple-700">
                                <Sparkles className="h-3 w-3" />
                                체험
                              </Badge>
                            )}
                          </div>
                          {student.student_number && student.student_number !== '0' && student.student_number !== '00' && (
                            <div className="text-sm text-muted-foreground">
                              {formatStudentNumber(student.student_number)}
                            </div>
                          )}
                          <div className="mt-1 flex items-center text-xs text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" />
                            {formatPhoneNumber(student.phone)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {student.gender ? (
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                          student.gender === 'male'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {GENDER_LABELS[student.gender]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="text-sm text-foreground">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                          student.student_type === 'exam' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {STUDENT_TYPE_LABELS[student.student_type]}
                        </span>
                        <span className="ml-2">{getStudentDisplayInfo(student)}</span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                        student.admission_type === 'regular'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : student.admission_type === 'early'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {ADMISSION_TYPE_LABELS[student.admission_type] || student.admission_type}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="text-sm text-foreground">
                        {formatClassDays(student.class_days)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        주 {student.weekly_count}회
                      </div>
                    </td>

                    {!hideMonthlyTuition && (
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(student.monthly_tuition)}
                        </div>
                        {discountRate > 0 && (
                          <div className="text-xs text-red-500">
                            {discountRate}% 할인
                          </div>
                        )}
                      </td>
                    )}

                    <td className="whitespace-nowrap px-4 py-4">
                      <div>
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${getStatusColor(
                            student.status
                          )}`}
                        >
                          {STATUS_LABELS[student.status] || student.status}
                        </span>
                        {student.status === 'paused' && student.rest_start_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(student.rest_start_date)}
                            {student.rest_end_date
                              ? ` ~ ${formatDate(student.rest_end_date)}`
                              : ' ~ (무기한)'}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="mr-1 h-4 w-4" />
                        {formatDate(student.enrollment_date)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <button
                        type="button"
                        aria-label={`${student.name} 상세 보기`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onStudentClick(student.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        상세
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
