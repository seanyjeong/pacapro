import { UserRound } from 'lucide-react';
import type { AttendanceStatus } from '@/lib/types/schedule';
import { TABLET_MARKS, TABLET_STATUS_META } from './tablet-attendance-constants';
import type { TabletAttendanceMark, TabletAttendanceStudent } from './tablet-attendance-types';

interface TabletAttendanceCardProps {
  saving: boolean;
  student: TabletAttendanceStudent;
  onChange: (student: TabletAttendanceStudent, status: TabletAttendanceMark) => void;
}

export function TabletAttendanceCard({ saving, student, onChange }: TabletAttendanceCardProps) {
  const activeStatus = student.attendance_status as AttendanceStatus | null;
  const activeMeta = TABLET_MARKS.includes(activeStatus as TabletAttendanceMark)
    ? TABLET_STATUS_META[activeStatus as TabletAttendanceMark]
    : null;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950" data-testid="tablet-attendance-card">
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{student.student_name}</h2>
            {activeMeta && <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${activeMeta.badgeClassName}`}>{activeMeta.label}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {student.grade && student.grade !== '0' && student.grade !== '00' && <span>{student.grade}</span>}
            {student.season_type && <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-orange-700">시즌</span>}
            {student.is_trial && <span className="rounded-full bg-pink-50 px-1.5 py-0.5 text-pink-700">체험 {student.trial_remaining ?? 0}회</span>}
            {student.is_makeup && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-700">보충</span>}
          </div>
        </div>
      </div>

      {student.notes && (
        <div className="mt-2 rounded-md bg-zinc-100 px-2 py-1.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {student.notes}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {TABLET_MARKS.map((status) => {
          const meta = TABLET_STATUS_META[status];
          const active = student.attendance_status === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              onClick={() => onChange(student, status)}
              className={`rounded-lg border px-2 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${active ? meta.activeClassName : meta.buttonClassName}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </article>
  );
}
