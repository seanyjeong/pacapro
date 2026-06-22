import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarCog, CheckCircle2, CreditCard, MessageSquare, Monitor } from 'lucide-react';
import type { TabletStudentDetail } from './tablet-student-detail-types';

interface TabletStudentActionsProps {
  student: TabletStudentDetail;
}

export function TabletStudentActions({ student }: TabletStudentActionsProps) {
  return (
    <nav aria-label="학생 업무 바로가기" className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-5">
      <StudentActionLink href={`/tablet/payments?studentId=${student.id}`} label={`${student.name} 결제 확인`} icon={<CreditCard className="h-4 w-4" />}>
        결제 확인
      </StudentActionLink>
      <StudentActionLink href={`/tablet/sms?studentId=${student.id}&recipient=parent`} label={`${student.name} 문자 보내기`} icon={<MessageSquare className="h-4 w-4" />}>
        문자 보내기
      </StudentActionLink>
      <StudentActionLink href={`/tablet/attendance?studentId=${student.id}`} label={`${student.name} 출석 체크`} icon={<CheckCircle2 className="h-4 w-4" />}>
        출석 체크
      </StudentActionLink>
      <StudentActionLink href="/students/class-days" label={`${student.name} 수업일관리`} icon={<CalendarCog className="h-4 w-4" />}>
        수업일관리
      </StudentActionLink>
      <StudentActionLink href={`/students/${student.id}`} label={`${student.name} PC 상세 열기`} icon={<Monitor className="h-4 w-4" />}>
        PC 상세
      </StudentActionLink>
    </nav>
  );
}

function StudentActionLink({ children, href, icon, label }: { children: ReactNode; href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      aria-label={label}
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      {icon}
      {children}
    </Link>
  );
}
