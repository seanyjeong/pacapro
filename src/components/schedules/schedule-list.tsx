'use client';

/**
 * 수업 목록 컴포넌트
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock, Edit, Trash2, User, UserPlus, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';
import { TIME_SLOT_BADGE } from '@/features/schedules/time-slot-meta';
import { cn } from '@/lib/utils';
import {
  formatDateKorean,
  getTimeSlotLabel,
  getScheduleTitle,
} from '@/lib/utils/schedule-helpers';
import type { ClassSchedule } from '@/lib/types/schedule';

interface ScheduleListProps {
  schedules: ClassSchedule[];
  onScheduleClick?: (schedule: ClassSchedule) => void;
  onEdit?: (schedule: ClassSchedule) => void;
  onDelete?: (schedule: ClassSchedule) => void;
  onAssignInstructor?: (schedule: ClassSchedule) => void;
  emptyMessage?: string;
}

export function ScheduleList({
  schedules,
  onScheduleClick,
  onEdit,
  onDelete,
  onAssignInstructor,
  emptyMessage = '수업이 없습니다.',
}: ScheduleListProps) {
  if (schedules.length === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={Calendar} title={emptyMessage} />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-card">
      <div className="hidden overflow-x-auto px-3 pb-2 pt-1 md:block" data-testid="schedule-list-table">
        <table className="w-full text-sm">
          <thead className="text-left text-[13px] font-semibold text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-3 py-3.5">수업</th>
              <th className="px-3 py-3.5">일정</th>
              <th className="px-3 py-3.5">강사</th>
              <th className="px-3 py-3.5">출석</th>
              <th className="px-3 py-3.5 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr
                key={schedule.id}
                className={cn('border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60', onScheduleClick && 'cursor-pointer')}
                onClick={() => onScheduleClick?.(schedule)}
              >
                <td className="px-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">{getScheduleTitle(schedule)}</p>
                    {schedule.content && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{schedule.content}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-secondary-foreground">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDateKorean(schedule.class_date)}
                    </div>
                    <Badge variant={TIME_SLOT_BADGE[schedule.time_slot]} className="gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeSlotLabel(schedule.time_slot)}
                    </Badge>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2 text-secondary-foreground">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {schedule.instructor_name || '강사'}
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <AttendanceBadge completed={schedule.attendance_taken} />
                </td>
                <td className="px-3 py-3.5">
                  <ScheduleActions
                    schedule={schedule}
                    onAssignInstructor={onAssignInstructor}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border/60 md:hidden" data-testid="schedule-list-mobile">
        {schedules.map((schedule) => (
          <div key={schedule.id} className={cn('space-y-2.5 px-4 py-4', onScheduleClick && 'cursor-pointer')} onClick={() => onScheduleClick?.(schedule)}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[16px] font-bold text-foreground">{getScheduleTitle(schedule)}</p>
                <AttendanceBadge completed={schedule.attendance_taken} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-secondary-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDateKorean(schedule.class_date)}
                </span>
                <Badge variant={TIME_SLOT_BADGE[schedule.time_slot]} className="gap-1">
                  <Clock className="h-3 w-3" />
                  {getTimeSlotLabel(schedule.time_slot)}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {schedule.instructor_name || '강사'}
                </span>
              </div>
              {schedule.content && (
                <p className="line-clamp-2 text-[13px] text-muted-foreground">{schedule.content}</p>
              )}
              {schedule.notes && (
                <div className="rounded-xl bg-muted p-3 text-[13px] text-secondary-foreground">{schedule.notes}</div>
              )}
              <ScheduleActions
                schedule={schedule}
                onAssignInstructor={onAssignInstructor}
                onDelete={onDelete}
                onEdit={onEdit}
              />
          </div>
        ))}
      </div>
    </section>
  );
}

function AttendanceBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <Badge variant="success" className="gap-1 whitespace-nowrap">
      <CheckCircle className="h-3 w-3" />
      출석 완료
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 whitespace-nowrap">
      <XCircle className="h-3 w-3" />
      출석 대기
    </Badge>
  );
}

function ScheduleActions({
  schedule,
  onAssignInstructor,
  onDelete,
  onEdit,
}: Pick<ScheduleListProps, 'onAssignInstructor' | 'onDelete' | 'onEdit'> & { schedule: ClassSchedule }) {
  if (!onEdit && !onDelete && !onAssignInstructor) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {onAssignInstructor && (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onAssignInstructor(schedule);
          }}
        >
          <UserPlus className="h-4 w-4" />
          강사 배정
        </Button>
      )}
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(schedule);
          }}
        >
          <Edit className="h-4 w-4" />
          수정
        </Button>
      )}
      {onDelete && (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(schedule);
          }}
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </Button>
      )}
    </div>
  );
}
