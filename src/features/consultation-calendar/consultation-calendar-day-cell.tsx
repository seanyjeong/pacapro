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
      className={`group relative min-h-[100px] rounded-lg border p-1 transition-colors ${
        hasEntries ? 'hover:bg-blue-50' : 'hover:bg-gray-50'
      } ${isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`text-sm font-medium ${
              dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
            }`}
            onClick={() => onDateClick(date)}
          >
            {format(date, 'd')}
          </button>
          {memos.length > 0 && (
            <div className="flex items-center gap-0.5" title={`상담 메모 ${memos.length}건`}>
              <FileText className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-600">{memos.length}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCreateLearning(date);
          }}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-emerald-100 group-hover:opacity-100"
          title="재원생 상담 등록"
        >
          <Plus className="h-3.5 w-3.5 text-emerald-600" />
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
              {isLearning && <UserCheck className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600" />}
              <span className={`truncate ${isDone ? 'text-gray-400 line-through' : ''}`}>
                {consultation.student_name}
              </span>
            </span>
          );
        })}
        {consultations.length > 3 && (
          <span className="block pl-3 text-xs text-gray-500">+{consultations.length - 3}건 더</span>
        )}
        {memos.slice(0, 2).map((memo) => (
          <span
            key={`memo-${memo.id}`}
            className="flex items-center gap-1 truncate rounded bg-amber-50 px-1 text-xs text-amber-700"
          >
            <FileText className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{memo.student_name}</span>
          </span>
        ))}
        {memos.length > 2 && (
          <span className="block pl-3 text-xs text-amber-500">+{memos.length - 2}건 메모</span>
        )}
      </button>
    </div>
  );
}
