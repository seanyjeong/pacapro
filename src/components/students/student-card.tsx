import { StudentParentDetails } from '@/components/students/student-parent-details';
import { Calendar, MapPin, UserRound } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';
import { StudentMemoDetail } from '@/components/students/student-memo-detail';
import type { StudentDetail } from '@/lib/types/student';
import { formatDate, formatPhoneNumber } from '@/lib/utils/student-helpers';

interface StudentCardProps {
  student: StudentDetail;
}

// 학생 상세의 '학생 정보' 카드: 연락처·보호자·기타. 이름·구분은 맨 위 요약에, 수업·학원비는 숫자 요약에 있다.
export function StudentCard({ student }: StudentCardProps) {
  const academyName = student.academy_name || 'P-ACA';

  return (
    <SectionCard title="학생 정보" description={`${academyName} 기준 등록 정보예요.`}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <DetailRow label="학생 연락처" value={displayValue(formatPhoneNumber(student.phone))} />
          <DetailRow label="학부모 연락처" value={displayValue(formatPhoneNumber(student.parent_phone))} />
        </div>

        <StudentParentDetails student={student} />

        <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2 xl:grid-cols-1">
          <DetailRow icon={MapPin} label="주소" value={displayValue(student.address)} />
          <DetailRow icon={Calendar} label="등록일" value={displayValue(formatDate(student.enrollment_date))} />
          {student.notes ? (
            <DetailRow className="sm:col-span-2 xl:col-span-1" label="비고" value={student.notes} />
          ) : null}
          <StudentMemoDetail memo={student.memo} />
        </div>
      </div>
    </SectionCard>
  );
}

function DetailRow({
  className,
  icon: Icon,
  label,
  value,
}: {
  className?: string;
  icon?: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 break-words text-[15px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-';
}
