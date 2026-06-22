import Link from 'next/link';
import type { ReactNode } from 'react';
import { CreditCard, MessageSquare, Phone, School, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/types/student';
import { STATUS_LABELS } from '@/lib/types/student';
import { getStatusColor, getStudentDisplayInfo } from '@/lib/utils/student-helpers';
import { formatTabletClassDays, formatTabletPhone, formatTabletWon } from './tablet-student-utils';

interface TabletStudentCardListProps {
  loading: boolean;
  students: Student[];
}

export function TabletStudentCardList({ loading, students }: TabletStudentCardListProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        학생 목록을 불러오는 중입니다.
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-base font-semibold text-foreground">표시할 학생이 없습니다</p>
        <p className="mt-1 text-sm text-muted-foreground">상태 탭이나 검색어를 조정해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2" data-testid="tablet-student-card-list">
      {students.map((student) => (
        <article
          key={student.id}
          data-testid="tablet-student-card"
          className="rounded-lg border border-border bg-card p-4 shadow-none"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
              {student.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{student.name}</h2>
                <Badge className={`rounded-md border text-xs ${getStatusColor(student.status)}`}>
                  {STATUS_LABELS[student.status] || student.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {getStudentDisplayInfo(student)}
                {student.school ? ` · ${student.school}` : ''}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label="전화" value={formatTabletPhone(student.phone)} icon={<Phone className="h-4 w-4" />} />
            <InfoRow label="수업" value={`${formatTabletClassDays(student.class_days)} · 주 ${student.weekly_count || 0}회`} icon={<School className="h-4 w-4" />} />
            <InfoRow label="학원비" value={formatTabletWon(student.final_monthly_tuition || student.monthly_tuition)} icon={<CreditCard className="h-4 w-4" />} />
            <InfoRow label="구분" value={student.is_trial ? '체험 관리' : '재원 관리'} icon={<UserRound className="h-4 w-4" />} />
          </dl>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
            <ActionLink href={`/tablet/students/${student.id}`} label={`${student.name} 상세 보기`}>
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
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function ActionLink({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return (
    <Link
      aria-label={label}
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 text-sm font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      {children}
    </Link>
  );
}
