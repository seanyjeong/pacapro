import { Calendar, MapPin, NotebookText, Phone, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentAvatar } from '@/components/students/student-avatar';
import type { StudentDetail } from '@/lib/types/student';
import {
  ADMISSION_TYPE_LABELS,
  GENDER_LABELS,
  STATUS_LABELS,
  STUDENT_TYPE_LABELS,
} from '@/lib/types/student';
import {
  formatClassDays,
  formatCurrency,
  formatDate,
  formatPhoneNumber,
  formatStudentNumber,
  getEffectiveMonthlyTuition,
  getStatusColor,
  getStudentDisplayInfo,
} from '@/lib/utils/student-helpers';

interface StudentCardProps {
  student: StudentDetail;
}

export function StudentCard({ student }: StudentCardProps) {
  const discountRate = Number.parseFloat(student.discount_rate) || 0;
  const effectiveTuition = getEffectiveMonthlyTuition(student);
  const academyName = student.academy_name || 'P-ACA';

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">학생 정보</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{academyName} 기준의 등록 정보입니다.</p>
          </div>
          <StatusBadge status={student.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_184px] lg:items-start">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{student.name}</h2>
              <span className="text-sm text-muted-foreground">학번: {displayValue(formatStudentNumber(student.student_number))}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <QuietBadge>{STUDENT_TYPE_LABELS[student.student_type]}</QuietBadge>
              {student.gender ? <QuietBadge>{GENDER_LABELS[student.gender]}</QuietBadge> : null}
              <QuietBadge>{getStudentDisplayInfo(student)}</QuietBadge>
              <QuietBadge>{ADMISSION_TYPE_LABELS[student.admission_type]}</QuietBadge>
            </div>
            {student.school ? <p className="text-sm text-muted-foreground">학교: {student.school}</p> : null}
          </div>
          <div className="flex justify-start lg:justify-end">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <StudentAvatar size="xl" student={student} />
            </div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-muted/30 p-4">
          <SectionTitle icon={Phone} title="연락처" />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailRow label="학생 연락처" value={displayValue(formatPhoneNumber(student.phone))} />
            <DetailRow label="학부모 연락처" value={displayValue(formatPhoneNumber(student.parent_phone))} />
          </div>
        </section>

        <section className="rounded-md border border-border bg-muted/30 p-4">
          <SectionTitle icon={Calendar} title="수업 및 학원비" />
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <DetailRow
              label="수업 요일"
              value={`${formatClassDays(student.class_days)} (주 ${student.weekly_count}회)`}
              helper={getNextClassDaysText(student)}
            />
            <DetailRow
              label="월 학원비"
              value={formatCurrency(student.monthly_tuition)}
              helper={discountRate > 0 ? `${discountRate}% 할인, 실납부 ${formatCurrency(effectiveTuition)}` : undefined}
            />
            <DetailRow
              label="실납부 기준"
              value={formatCurrency(effectiveTuition)}
              helper={student.payment_due_day ? `매월 ${student.payment_due_day}일 납부` : '학원 기본 납부일 적용'}
            />
          </div>
        </section>

        <section className="rounded-md border border-border bg-muted/30 p-4">
          <SectionTitle icon={NotebookText} title="기타 정보" />
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <DetailRow icon={MapPin} label="주소" value={displayValue(student.address)} />
            <DetailRow icon={Calendar} label="등록일" value={displayValue(formatDate(student.enrollment_date))} />
            {student.notes ? (
              <DetailRow className="md:col-span-2" label="메모" value={student.notes} />
            ) : null}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: StudentDetail['status'] }) {
  return (
    <span className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusColor(status)}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function QuietBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof UserRound; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {title}
    </div>
  );
}

function DetailRow({
  className,
  helper,
  icon: Icon,
  label,
  value,
}: {
  className?: string;
  helper?: string;
  icon?: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted-foreground">{helper}</div> : null}
    </div>
  );
}

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-';
}

function getNextClassDaysText(student: StudentDetail) {
  if (!student.class_days_next || !student.class_days_effective_from) return undefined;
  return `변경 예정: ${formatClassDays(student.class_days_next)} (${student.class_days_effective_from.slice(0, 7)}부터)`;
}
