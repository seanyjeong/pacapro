'use client';

/**
 * 수업 목록 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, CheckCircle, XCircle, Edit, Trash2, UserPlus } from 'lucide-react';
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
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">{emptyMessage}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <Card
          key={schedule.id}
          className={cn(
            'transition-all hover:shadow-md',
            onScheduleClick && 'cursor-pointer'
          )}
          onClick={() => onScheduleClick?.(schedule)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{getScheduleTitle(schedule)}</CardTitle>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDateKorean(schedule.class_date)}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('font-medium', getTimeSlotColor(schedule.time_slot))}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {getTimeSlotLabel(schedule.time_slot)}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {schedule.attendance_taken ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    출석 완료
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    출석 대기
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {/* 강사 정보 */}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{schedule.instructor_name || '강사'}</span>
              </div>

              {/* 수업 내용 */}
              {schedule.content && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {schedule.content}
                </p>
              )}

              {/* 메모 */}
              {schedule.notes && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">{schedule.notes}</p>
                </div>
              )}

              {/* 액션 버튼 */}
              {(onEdit || onDelete || onAssignInstructor) && (
                <div className="flex items-center gap-2 pt-2">
                  {onAssignInstructor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignInstructor(schedule);
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      강사 배정
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(schedule);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      수정
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(schedule);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
