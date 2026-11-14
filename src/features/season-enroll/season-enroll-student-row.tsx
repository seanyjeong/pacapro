import Link from 'next/link';
import { CheckCircle, ExternalLink, Loader2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
      className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
      data-testid={isAvailable ? 'available-student-row' : 'enrolled-student-row'}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            aria-label={`${student.name} 학생 상세`}
            className="min-w-0 truncate text-[16px] font-bold text-foreground underline-offset-4 hover:underline"
            href={`/students/${student.id}`}
          >
            {student.name}
          </Link>
          <Badge variant={isAvailable ? 'default' : 'success'}>{isAvailable ? '등록 가능' : '등록 완료'}</Badge>
          {student.status === 'paused' ? <Badge variant="warning">휴원</Badge> : null}
        </div>
        <p className="truncate text-[13px] text-muted-foreground">{meta}</p>
      </div>
      {isAvailable ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Link
            aria-label={`${student.name} 학생 상세 열기`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href={`/students/${student.id}`}
          >
            <ExternalLink className="h-4 w-4" />
            상세
          </Link>
          <Button size="sm" onClick={() => onEnrollClick(student)} disabled={enrolling}>
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                시간대 선택
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Link
            aria-label={`${student.name} 학생 상세 열기`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href={`/students/${student.id}`}
          >
            <ExternalLink className="h-4 w-4" />
            상세
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-success" aria-label="등록 완료 상태">
            <CheckCircle className="h-4 w-4" />
            완료
          </div>
        </div>
      )}
    </div>
  );
}
