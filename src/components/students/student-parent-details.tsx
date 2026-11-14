import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { STUDENT_PARENT_INFO_SECTION_ID, STUDENT_PARENT_NAME_FIELDS } from '@/constants/student-parent-names';
import type { StudentParentNames } from '@/lib/types/student-parent-names';
import type { StudentParentPhones } from '@/lib/types/student-parent-phones';
import { visibleParentName } from '@/lib/utils/student-parent-names';

export function StudentParentDetails({ student }: { student: StudentParentNames & StudentParentPhones & { id: number } }) {
  const hasInfo = STUDENT_PARENT_NAME_FIELDS.some(({ field, phoneField }) =>
    visibleParentName(student[field]) || visibleParentName(student[phoneField]));

  return (
    <div className="border-t border-border/60 pt-4" data-testid="student-parent-details">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">보호자 정보</h3>
        <Link
          href={`/students/${student.id}/edit#${STUDENT_PARENT_INFO_SECTION_ID}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {hasInfo ? '보호자 정보 수정' : '보호자 정보 입력'}
        </Link>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-1">
        {STUDENT_PARENT_NAME_FIELDS.map(({ field, label, phoneField, phoneLabel }) => (
          <div key={field} className="min-w-0 space-y-1">
            <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {visibleParentName(student[field]) || '미입력'}
            </dd>
            <dt className="pt-2 text-[13px] font-medium text-muted-foreground">{phoneLabel}</dt>
            <dd className="break-words text-sm font-medium text-foreground">
              {visibleParentName(student[phoneField]) ? (
                <a href={`tel:${visibleParentName(student[phoneField])}`}
                  className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {visibleParentName(student[phoneField])}
                </a>
              ) : '미입력'}
            </dd>
          </div>
        ))}
      </dl>
      {!hasInfo && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          성함과 전화번호는 선택 입력입니다. 보호자 정보 입력에서 등록해주세요.
        </p>
      )}
    </div>
  );
}
