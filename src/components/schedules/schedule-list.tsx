'use client';

/**
 * 수업 목록 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock, Edit, Trash2, User, UserPlus, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateKorean,
  getTimeSlotLabel,
  getTimeSlotColor,
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
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-card md:block" data-testid="schedule-list-table">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">수업</th>
              <th className="px-4 py-3">일정</th>
              <th className="px-4 py-3">강사</th>
              <th className="px-4 py-3">출석</th>
              <th className="px-4 py-3 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map((schedule) => (
              <tr
                key={schedule.id}
                className={cn('transition-colors hover:bg-slate-50', onScheduleClick && 'cursor-pointer')}
                onClick={() => onScheduleClick?.(schedule)}
              >
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{getScheduleTitle(schedule)}</p>
                    {schedule.content && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{schedule.content}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {formatDateKorean(schedule.class_date)}
                    </div>
                    <Badge variant="outline" className={cn('gap-1 font-medium', getTimeSlotColor(schedule.time_slot))}>
                      <Clock className="h-3 w-3" />
                      {getTimeSlotLabel(schedule.time_slot)}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="h-4 w-4 text-slate-400" />
                    {schedule.instructor_name || '강사'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AttendanceBadge completed={schedule.attendance_taken} />
                </td>
                <td className="px-4 py-3">
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

      <div className="space-y-3 md:hidden" data-testid="schedule-list-mobile">
        {schedules.map((schedule) => (
          <Card key={schedule.id} className={cn('rounded-md', onScheduleClick && 'cursor-pointer')} onClick={() => onScheduleClick?.(schedule)}>
            <CardHeader className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="min-w-0 text-base tracking-normal">{getScheduleTitle(schedule)}</CardTitle>
                <AttendanceBadge completed={schedule.attendance_taken} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDateKorean(schedule.class_date)}
                </span>
                <Badge variant="outline" className={cn('gap-1', getTimeSlotColor(schedule.time_slot))}>
                  <Clock className="h-3 w-3" />
                  {getTimeSlotLabel(schedule.time_slot)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{schedule.instructor_name || '강사'}</span>
              </div>
              {schedule.content && (
                <p className="line-clamp-2 text-sm text-slate-500">{schedule.content}</p>
              )}
              {schedule.notes && (
                <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{schedule.notes}</div>
              )}
              <ScheduleActions
                schedule={schedule}
                onAssignInstructor={onAssignInstructor}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
          <UserPlus className="mr-1.5 h-4 w-4" />
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
          <Edit className="mr-1.5 h-4 w-4" />
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
          <Trash2 className="mr-1.5 h-4 w-4" />
          삭제
        </Button>
      )}
    </div>
  );
}
