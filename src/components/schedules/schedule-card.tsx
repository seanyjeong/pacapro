'use client';

/**
 * 수업 기본 정보 카드 컴포넌트
 */

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
import { TIME_SLOT_BADGE } from '@/features/schedules/time-slot-meta';
import {
  formatDateKorean,
  getTimeSlotLabel,
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
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-[19px] font-bold tracking-tight text-foreground">{getScheduleTitle(schedule)}</h2>
        {schedule.attendance_taken ? (
          <Badge variant="success" className="shrink-0">
            <CheckCircle className="h-3 w-3" />
            출석 완료
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            <XCircle className="h-3 w-3" />
            출석 대기
          </Badge>
        )}
      </div>

      <dl className="mt-4 divide-y divide-border/60">
        <InfoRow icon={Calendar} label="수업 날짜">{formatDateKorean(schedule.class_date)}</InfoRow>
        <InfoRow icon={Clock} label="시간대">
          <Badge variant={TIME_SLOT_BADGE[schedule.time_slot]}>{getTimeSlotLabel(schedule.time_slot)}</Badge>
        </InfoRow>
        <InfoRow icon={User} label="강사">{schedule.instructor_name || '강사'}</InfoRow>
      </dl>

      {/* 수업 내용 */}
      {schedule.content && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-secondary-foreground">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            수업 내용
          </p>
          <p className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm text-foreground">{schedule.content}</p>
        </div>
      )}

      {/* 메모 */}
      {schedule.notes && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-secondary-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            메모
          </p>
          <p className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm text-foreground">{schedule.notes}</p>
        </div>
      )}

      {/* 액션 버튼 */}
      {showActions && (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {onAttendanceClick && (
            <Button
              variant={schedule.attendance_taken ? 'secondary' : 'default'}
              onClick={onAttendanceClick}
            >
              <CheckCircle className="h-4 w-4" />
              {schedule.attendance_taken ? '출석 보기' : '출석 체크'}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {onEdit && (
              <Button variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4" />
                수정
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                삭제
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </dt>
      <dd className="text-right text-[15px] font-semibold text-foreground">{children}</dd>
    </div>
  );
}
