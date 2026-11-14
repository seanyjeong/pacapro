import Link from 'next/link';
import type { ReactNode } from 'react';
import { CreditCard, MessageSquare, Phone, School, UserRound, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { StudentAvatar } from '@/components/students/student-avatar';
import { StudentStatusBadge } from '@/features/students/student-status-badge';
import type { Student } from '@/lib/types/student';
import { getStudentDisplayInfo } from '@/lib/utils/student-helpers';
import { formatTabletClassDays, formatTabletPhone, formatTabletWon } from './tablet-student-utils';

interface TabletStudentCardListProps {
  loading: boolean;
  students: Student[];
}

export function TabletStudentCardList({ loading, students }: TabletStudentCardListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground" role="status">
        학생 목록을 불러오는 중이에요.
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={Users} title="표시할 학생이 없어요" description="상태 탭이나 검색어를 바꿔 보세요." />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2" data-testid="tablet-student-card-list">
      {students.map((student) => (
        <article
          key={student.id}
          data-testid="tablet-student-card"
          className="rounded-2xl bg-card p-5"
        >
          <div className="flex items-center gap-3">
            <StudentAvatar student={student} size="sm" className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{student.name}</h2>
                <StudentStatusBadge status={student.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {getStudentDisplayInfo(student)}
                {student.school ? ` · ${student.school}` : ''}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-muted px-4 py-3 text-sm">
            <InfoRow label="전화" value={formatTabletPhone(student.phone)} icon={<Phone className="h-4 w-4" />} />
            <InfoRow label="수업" value={`${formatTabletClassDays(student.class_days)} · 주 ${student.weekly_count || 0}회`} icon={<School className="h-4 w-4" />} />
            <InfoRow label="학원비" value={formatTabletWon(student.final_monthly_tuition || student.monthly_tuition)} icon={<CreditCard className="h-4 w-4" />} />
            <InfoRow label="구분" value={student.is_trial ? '체험 관리' : '재원 관리'} icon={<UserRound className="h-4 w-4" />} />
          </dl>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <ActionLink href={`/tablet/students/${student.id}`} label={`${student.name} 상세 보기`} primary>
              상세
            </ActionLink>
            <ActionLink href={`/tablet/sms?studentId=${student.id}&recipient=parent`} label={`${student.name} 문자 보내기`}>
              <MessageSquare className="h-4 w-4" />
              문자
            </ActionLink>
            <ActionLink href={`/tablet/payments?studentId=${student.id}`} label={`${student.name} 결제 확인`}>
              <CreditCard className="h-4 w-4" />
              결제
            </ActionLink>
          </div>
        </article>
      ))}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-semibold text-foreground tabular-nums">{value}</dd>
      </div>
    </div>
  );
}

function ActionLink({ children, href, label, primary }: { children: ReactNode; href: string; label: string; primary?: boolean }) {
  return (
    <Link aria-label={label} href={href} className={buttonVariants({ variant: primary ? 'secondary' : 'outline', className: 'px-2' })}>
      {children}
    </Link>
  );
}
