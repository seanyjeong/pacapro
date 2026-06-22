import Link from 'next/link';
import { CalendarCheck, ClipboardCheck, Edit, PhoneCall, Sunrise, Sun, Moon, UserCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { DailyInstructorStats } from '@/lib/api/schedules';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { formatDateKorean, getScheduleTitle } from '@/lib/utils/schedule-helpers';

const SLOT_META: Array<{ slot: TimeSlot; icon: typeof Sun; tone: string }> = [
  { slot: 'morning', icon: Sunrise, tone: 'text-orange-700 bg-orange-50 border-orange-200' },
  { slot: 'afternoon', icon: Sun, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  { slot: 'evening', icon: Moon, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
];

interface SelectedDateOperationsProps {
  consultations: Record<string, Consultation[]>;
  instructorStats: Record<string, DailyInstructorStats>;
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onConsultationClick: (date: string) => void;
  onSlotClick: (date: string, slot: TimeSlot) => void;
}

export function SelectedDateOperations({
  consultations,
  instructorStats,
  schedules,
  selectedDate,
  onConsultationClick,
  onSlotClick,
}: SelectedDateOperationsProps) {
  if (!selectedDate) return null;

  const dailySchedules = schedules.filter((schedule) => schedule.class_date === selectedDate);
  const schedulesBySlot = new Map(dailySchedules.map((schedule) => [schedule.time_slot, schedule]));
  const dailyStats = instructorStats[selectedDate];
  const dailyConsultations = consultations[selectedDate] || [];

  return (
    <section
      className="rounded-md border border-slate-200 bg-card px-4 py-4 shadow-sm"
      data-testid="selected-date-operations"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <CalendarCheck className="h-4 w-4" />
            선택일 운영
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-normal text-slate-950">
            {formatDateKorean(selectedDate)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3.5 w-3.5" />
            학생 {dailySchedules.reduce((sum, schedule) => sum + (schedule.student_count || 0), 0)}명
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <PhoneCall className="h-3.5 w-3.5" />
            상담 {dailyConsultations.length}건
          </Badge>
          {dailyConsultations.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => onConsultationClick(selectedDate)}>
              상담 보기
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {SLOT_META.map(({ slot, icon: Icon, tone }) => {
          const schedule = schedulesBySlot.get(slot);
          const title = schedule ? getScheduleTitle(schedule) : `${TIME_SLOT_LABELS[slot]} 수업 없음`;
          const stats = dailyStats?.[slot];
          const attended = stats?.attended || 0;
          const scheduled = stats?.scheduled || 0;

          return (
            <div key={slot} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border', tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-950">{TIME_SLOT_LABELS[slot]}반</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-800">{title}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => onSlotClick(selectedDate, slot)}
                >
                  {TIME_SLOT_LABELS[slot]}반 열기
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span>학생 {schedule?.student_count || 0}명</span>
                <span>체험 {schedule?.trial_count || 0}명</span>
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  강사 {attended}/{scheduled}
                </span>
              </div>

              {schedule && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1 px-2')}
                    href={`/schedules/${schedule.id}`}
                    aria-label={`${title} 상세`}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    상세
                  </Link>
                  <Link
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1 px-2')}
                    href={`/schedules/${schedule.id}/attendance`}
                    aria-label={`${title} 출석 체크`}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    출석
                  </Link>
                  <Link
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 gap-1 px-2')}
                    href={`/schedules/${schedule.id}/edit`}
                    aria-label={`${title} 수정`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    수정
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
