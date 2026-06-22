import type { AttendanceSummary } from './salary-detail-types';
import { getDayName, isWeekend } from './salary-detail-utils';

interface SalaryAttendanceSectionProps {
  attendanceSummary: AttendanceSummary | null;
}

export function SalaryAttendanceSection({ attendanceSummary }: SalaryAttendanceSectionProps) {
  if (!attendanceSummary || Object.keys(attendanceSummary.daily_breakdown).length === 0) return null;

  return (
    <section className="print-section overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 bg-blue-50 p-3 print-compact">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-semibold text-blue-900">{attendanceSummary.work_year_month} 출근 내역</h2>
          <p className="text-xs text-blue-800">
            출근 {attendanceSummary.attendance_days}일 / 총 {attendanceSummary.total_classes}회
          </p>
        </div>
      </div>
      <table className="w-full text-xs print-table">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">날짜</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">요일</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">시간대</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">출근</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground">퇴근</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Object.entries(attendanceSummary.daily_breakdown).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, data]) =>
            data.details.map((detail, index) => (
              <tr key={`${date}-${index}`} className={isWeekend(date) ? 'bg-red-50' : ''}>
                {index === 0 ? (
                  <>
                    <td className="px-2 py-1 font-medium" rowSpan={data.details.length}>{formatShortDate(date)}</td>
                    <td className="px-2 py-1" rowSpan={data.details.length}>{getDayName(date)}</td>
                  </>
                ) : null}
                <td className="px-2 py-1">{detail.time_slot_label}</td>
                <td className="px-2 py-1 text-muted-foreground">{detail.check_in_time || '-'}</td>
                <td className="px-2 py-1 text-muted-foreground">{detail.check_out_time || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {attendanceSummary.total_hours > 0 ? (
        <div className="border-t border-border/70 bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
          총 근무시간 <span className="font-semibold text-foreground">{attendanceSummary.total_hours}시간</span>
        </div>
      ) : null}
    </section>
  );
}

function formatShortDate(date: string) {
  const dateObject = new Date(date);
  return `${dateObject.getMonth() + 1}/${dateObject.getDate()}`;
}
