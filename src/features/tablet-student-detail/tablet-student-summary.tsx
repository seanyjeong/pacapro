import { Calendar, CheckCircle2, CreditCard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toneIcon, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import { formatTabletClassDays, formatTabletWon } from '@/features/tablet-students/tablet-student-utils';
import type { TabletAttendanceSummary, TabletStudentDetail } from './tablet-student-detail-types';
import { formatTabletEnrollmentDate } from './tablet-student-detail-utils';

interface TabletStudentSummaryProps {
  attendanceSummary: TabletAttendanceSummary | null;
  student: TabletStudentDetail;
}

export function TabletStudentSummary({ attendanceSummary, student }: TabletStudentSummaryProps) {
  const effectiveTuition = student.final_monthly_tuition || student.monthly_tuition;

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <SummaryPanel icon={CheckCircle2} tone="success" title="이번달 출석">
        {attendanceSummary ? (
          <>
            <Metric label="출석률" value={`${attendanceSummary.rate}%`} strong />
            <Metric label="출석" value={`${attendanceSummary.present}회`} />
            <Metric label="결석" value={`${attendanceSummary.absent}회`} />
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">출석 정보 없음</p>
        )}
      </SummaryPanel>

      <SummaryPanel icon={Calendar} tone="primary" title="수업 정보">
        <Metric label="수업 요일" value={formatTabletClassDays(student.class_days)} />
        <Metric label="등록일" value={formatTabletEnrollmentDate(student.enrollment_date)} />
      </SummaryPanel>

      <SummaryPanel icon={CreditCard} tone="success" title="결제 기준">
        <Metric label="실납부" value={formatTabletWon(effectiveTuition)} strong />
        <Metric label="할인율" value={`${Number(student.discount_rate || 0)}%`} />
      </SummaryPanel>
    </section>
  );
}

function SummaryPanel({ children, icon: Icon, title, tone }: { children: React.ReactNode; icon: LucideIcon; title: string; tone: Tone }) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', toneIcon[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-[17px] font-bold text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function Metric({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums text-foreground', strong ? 'text-xl font-extrabold' : 'text-[15px] font-semibold')}>{value}</span>
    </div>
  );
}
