'use client';

/**
 * 수업 기본 정보 카드 컴포넌트
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  BookOpen,
  FileText,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateKorean,
  getTimeSlotLabel,
  getTimeSlotColor,
  getScheduleTitle,
} from '@/lib/utils/schedule-helpers';
import type { ClassSchedule } from '@/lib/types/schedule';

interface ScheduleCardProps {
  schedule: ClassSchedule;
  onEdit?: () => void;
  onDelete?: () => void;
  onAttendanceClick?: () => void;
  showActions?: boolean;
}

export function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onAttendanceClick,
  showActions = true,
}: ScheduleCardProps) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="text-lg tracking-normal">{getScheduleTitle(schedule)}</CardTitle>
          <div className="flex items-center gap-2">
            {schedule.attendance_taken ? (
              <Badge variant="default" className="bg-emerald-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                출석 완료
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="mr-1 h-3 w-3" />
                출석 대기
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">수업 날짜</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateKorean(schedule.class_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">시간대</p>
                <Badge variant="outline" className={cn('mt-1', getTimeSlotColor(schedule.time_slot))}>
                  {getTimeSlotLabel(schedule.time_slot)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">강사</p>
                <p className="text-sm text-muted-foreground">
                  {schedule.instructor_name || '강사'}
                </p>
              </div>
            </div>
          </div>

          {/* 수업 내용 */}
          {schedule.content && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">수업 내용</p>
              </div>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap">{schedule.content}</p>
              </div>
            </div>
          )}

          {/* 메모 */}
          {schedule.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">메모</p>
              </div>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap">{schedule.notes}</p>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          {showActions && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {onAttendanceClick && (
                <Button
                  variant={schedule.attendance_taken ? 'outline' : 'default'}
                  onClick={onAttendanceClick}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {schedule.attendance_taken ? '출석 보기' : '출석 체크'}
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  수정
                </Button>
              )}
              {onDelete && (
                <Button variant="outline" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
