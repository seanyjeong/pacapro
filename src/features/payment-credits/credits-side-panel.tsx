import Link from 'next/link';
import { ChevronRight, Layers3, Users } from 'lucide-react';
import { ListRow, SectionCard, toneIcon } from '@/components/ui/page';
import type { CreditTypeStats, StudentWithCredit } from '@/lib/types/payment';
import { formatWon, getCreditTypeLabel, getStudentStatusLabel } from './credits-utils';

interface CreditsSidePanelProps {
  students: StudentWithCredit[];
  typeStats: CreditTypeStats[];
}

/** 표 아래 보조 정보: 크레딧 보유 학생(앞 4명)과 유형별 잔액. 위 요약 숫자와 겹치지 않는 것만. */
export function CreditsSidePanel({ students, typeStats }: CreditsSidePanelProps) {
  const visibleStudents = students.slice(0, 4);
  const hiddenStudentCount = Math.max(students.length - visibleStudents.length, 0);

  if (visibleStudents.length === 0 && typeStats.length === 0) return null;

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 md:items-start">
      {visibleStudents.length > 0 ? (
        <SectionCard title="보유 학생" description={`${students.length}명`}>
          <div className="divide-y divide-border/60" data-testid="credits-board-students">
            {visibleStudents.map((student) => (
              <Link
                key={student.id}
                aria-label={`${student.name} 학생 상세 보기`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
                href={`/students/${student.id}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneIcon.primary}`}>
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">{student.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {getStudentStatusLabel(student.student_status)} · {student.credit_count}건
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-bold tabular-nums text-foreground">{formatWon(student.total_remaining)}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
              </Link>
            ))}
          </div>
          {hiddenStudentCount > 0 ? <p className="mt-2 text-[13px] text-muted-foreground">외 {hiddenStudentCount}명은 표에서 확인하세요.</p> : null}
        </SectionCard>
      ) : null}

      {typeStats.length > 0 ? (
        <SectionCard title="유형 요약" description={<span data-testid="credits-metric-types">{typeStats.length}개</span>}>
          <div className="divide-y divide-border/60" data-testid="credits-board-types">
            {typeStats.map((stat) => (
              <ListRow
                key={stat.credit_type}
                icon={Layers3}
                title={getCreditTypeLabel(stat.credit_type)}
                detail={`${stat.count}건 · 총 ${formatWon(stat.total_amount)}`}
                trailing={(
                  <span className="text-[15px] font-bold tabular-nums text-foreground">
                    <span className="mr-1 text-[13px] font-medium text-muted-foreground">잔여</span>
                    {formatWon(stat.remaining_amount)}
                  </span>
                )}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
