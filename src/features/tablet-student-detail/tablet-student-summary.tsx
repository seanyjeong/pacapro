import { Calendar, CheckCircle2, CreditCard } from 'lucide-react';
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
    <section className="grid gap-4 lg:grid-cols-3">
      <SummaryPanel icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} title="이번달 출석">
        {attendanceSummary ? (
          <div className="space-y-2">
            <Metric label="출석률" value={`${attendanceSummary.rate}%`} strong />
            <Metric label="출석" value={`${attendanceSummary.present}회`} />
            <Metric label="결석" value={`${attendanceSummary.absent}회`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">출석 정보 없음</p>
        )}
      </SummaryPanel>

      <SummaryPanel icon={<Calendar className="h-5 w-5 text-blue-500" />} title="수업 정보">
        <div className="space-y-2">
          <Metric label="수업 요일" value={formatTabletClassDays(student.class_days)} />
          <Metric label="등록일" value={formatTabletEnrollmentDate(student.enrollment_date)} />
        </div>
      </SummaryPanel>

      <SummaryPanel icon={<CreditCard className="h-5 w-5 text-emerald-500" />} title="결제 기준">
        <div className="space-y-2">
          <Metric label="실납부" value={formatTabletWon(effectiveTuition)} strong />
          <Metric label="할인율" value={`${Number(student.discount_rate || 0)}%`} />
        </div>
      </SummaryPanel>
    </section>
  );
}

function SummaryPanel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-bold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}
