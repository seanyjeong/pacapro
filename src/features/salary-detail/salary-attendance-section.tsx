import { SectionCard } from '@/components/ui/page';
import type { AttendanceSummary } from './salary-detail-types';
import { getDayName, isWeekend } from './salary-detail-utils';

interface SalaryAttendanceSectionProps {
  attendanceSummary: AttendanceSummary | null;
}

export function SalaryAttendanceSection({ attendanceSummary }: SalaryAttendanceSectionProps) {
  if (!attendanceSummary || Object.keys(attendanceSummary.daily_breakdown).length === 0) return null;

  return (
    <SectionCard
      title={`${attendanceSummary.work_year_month} 출근 내역`}
      description={`출근 ${attendanceSummary.attendance_days}일 / 총 ${attendanceSummary.total_classes}회`}
      className="print-section"
      bodyClassName="print-compact"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm print-table">
          <thead>
            <tr className="border-b border-border/60 text-[13px] font-semibold text-muted-foreground">
              <th className="px-2 py-2.5 text-left font-semibold">날짜</th>
              <th className="px-2 py-2.5 text-left font-semibold">요일</th>
              <th className="px-2 py-2.5 text-left font-semibold">시간대</th>
              <th className="px-2 py-2.5 text-left font-semibold">출근</th>
              <th className="px-2 py-2.5 text-left font-semibold">퇴근</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(attendanceSummary.daily_breakdown).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, data]) =>
              data.details.map((detail, index) => (
                <tr key={`${date}-${index}`} className={`border-b border-border/60 ${isWeekend(date) ? 'bg-destructive-soft/60' : ''}`}>
                  {index === 0 ? (
                    <>
                      <td className="px-2 py-2 font-semibold tabular-nums text-foreground" rowSpan={data.details.length}>{formatShortDate(date)}</td>
                      <td className="px-2 py-2 text-secondary-foreground" rowSpan={data.details.length}>{getDayName(date)}</td>
                    </>
                  ) : null}
                  <td className="px-2 py-2 text-foreground">{detail.time_slot_label}</td>
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{detail.check_in_time || '-'}</td>
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{detail.check_out_time || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {attendanceSummary.total_hours > 0 ? (
        <p className="pt-3 text-right text-sm text-muted-foreground">
          총 근무시간 <span className="font-bold tabular-nums text-foreground">{attendanceSummary.total_hours}시간</span>
        </p>
      ) : null}
    </SectionCard>
  );
}

function formatShortDate(date: string) {
  const dateObject = new Date(date);
  return `${dateObject.getMonth() + 1}/${dateObject.getDate()}`;
}
