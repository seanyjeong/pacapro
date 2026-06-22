import Link from 'next/link';
import { CheckCircle, ExternalLink, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SeasonEnrollStudent } from './season-enroll-types';

interface SeasonEnrollStudentRowProps {
  enrolling: boolean;
  student: SeasonEnrollStudent;
  type: 'available' | 'enrolled';
  onEnrollClick: (student: SeasonEnrollStudent) => void;
}

export function SeasonEnrollStudentRow({ enrolling, student, type, onEnrollClick }: SeasonEnrollStudentRowProps) {
  const isAvailable = type === 'available';
  const meta = [student.grade || student.grade_type, student.phone].filter(Boolean).join(' · ') || '학생 정보';

  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      data-testid={isAvailable ? 'available-student-row' : 'enrolled-student-row'}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            aria-label={`${student.name} 학생 상세`}
            className="min-w-0 truncate text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
            href={`/students/${student.id}`}
          >
            {student.name}
          </Link>
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              isAvailable ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isAvailable ? '등록 가능' : '등록 완료'}
          </span>
        </div>
        <p className="truncate text-xs text-slate-500">{meta}</p>
      </div>
      {isAvailable ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Link
            aria-label={`${student.name} 학생 상세 열기`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            href={`/students/${student.id}`}
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            상세
          </Link>
          <Button size="sm" onClick={() => onEnrollClick(student)} disabled={enrolling}>
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-1 h-4 w-4" />
                시간대 선택
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Link
            aria-label={`${student.name} 학생 상세 열기`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            href={`/students/${student.id}`}
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            상세
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700" aria-label="등록 완료 상태">
            <CheckCircle className="h-4 w-4" />
            완료
          </div>
        </div>
      )}
    </div>
  );
}
