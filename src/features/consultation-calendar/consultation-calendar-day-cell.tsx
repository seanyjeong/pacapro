import { format, isSameDay } from 'date-fns';
import { FileText, Plus, UserCheck } from 'lucide-react';
import type { Consultation } from '@/lib/types/consultation';
import type { StudentConsultationMemo } from './consultation-calendar-types';
import { getStatusDot, isFinishedConsultation } from './consultation-calendar-utils';

interface ConsultationCalendarDayCellProps {
  date: Date;
  consultations: Consultation[];
  memos: StudentConsultationMemo[];
  onDateClick: (date: Date) => void;
  onCreateLearning: (date: Date) => void;
}

export function ConsultationCalendarDayCell({
  date,
  consultations,
  memos,
  onDateClick,
  onCreateLearning,
}: ConsultationCalendarDayCellProps) {
  const isToday = isSameDay(date, new Date());
  const dayOfWeek = date.getDay();
  const hasEntries = consultations.length > 0 || memos.length > 0;

  return (
    <div
      className={`group relative min-h-[74px] rounded-md border p-1.5 transition-colors sm:min-h-[96px] ${
        hasEntries ? 'hover:bg-primary-soft/70' : 'hover:bg-muted/40'
      } ${isToday ? 'border-primary/30 bg-primary-soft/80' : 'border-border bg-card'}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`text-sm font-semibold ${
              dayOfWeek === 0 ? 'text-destructive' : dayOfWeek === 6 ? 'text-primary' : 'text-foreground'
            }`}
            onClick={() => onDateClick(date)}
          >
            {format(date, 'd')}
          </button>
          {memos.length > 0 && (
            <div className="flex items-center gap-0.5" title={`상담 메모 ${memos.length}건`}>
              <FileText className="h-3 w-3 text-warning" />
              <span className="text-[10px] font-medium text-warning">{memos.length}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCreateLearning(date);
          }}
          className="rounded-md p-0.5 opacity-0 transition-opacity hover:bg-success-soft group-hover:opacity-100 focus:opacity-100"
          title="재원생 상담 등록"
        >
          <Plus className="h-3.5 w-3.5 text-success" />
        </button>
      </div>

      <button type="button" className="w-full space-y-1 text-left" onClick={() => onDateClick(date)}>
        {consultations.slice(0, 3).map((consultation) => {
          const isDone = isFinishedConsultation(consultation.status);
          const isLearning = consultation.consultation_type === 'learning';
          return (
            <span
              key={consultation.id}
              className={`flex items-center gap-1 truncate text-xs ${isDone ? 'opacity-60' : ''}`}
            >
              <i className={`h-2 w-2 flex-shrink-0 rounded-full ${getStatusDot(consultation.status, isLearning)}`} />
              {isLearning && <UserCheck className="h-2.5 w-2.5 flex-shrink-0 text-success" />}
              <span className={`truncate ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {consultation.student_name}
              </span>
            </span>
          );
        })}
        {consultations.length > 3 && (
          <span className="block pl-3 text-xs text-muted-foreground">+{consultations.length - 3}건 더</span>
        )}
        {memos.slice(0, 2).map((memo) => (
          <span
            key={`memo-${memo.id}`}
            className="flex items-center gap-1 truncate rounded-md bg-warning-soft px-1 text-xs text-warning"
          >
            <FileText className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{memo.student_name}</span>
          </span>
        ))}
        {memos.length > 2 && (
          <span className="block pl-3 text-xs text-warning">+{memos.length - 2}건 메모</span>
        )}
      </button>
    </div>
  );
}
