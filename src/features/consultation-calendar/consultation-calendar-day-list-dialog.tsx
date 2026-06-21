import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Phone, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Consultation } from '@/lib/types/consultation';
import { LEARNING_TYPE_LABELS } from '@/lib/types/consultation';
import { ConsultationCalendarStatusBadge } from './consultation-calendar-status-badge';
import { getStatusDot, groupConsultationsByHour, isFinishedConsultation } from './consultation-calendar-utils';

interface ConsultationCalendarDayListDialogProps {
  open: boolean;
  selectedDate: Date | null;
  consultations: Consultation[];
  onOpenChange: (open: boolean) => void;
  onOpenDetail: (consultation: Consultation) => void;
}

export function ConsultationCalendarDayListDialog({
  open,
  selectedDate,
  consultations,
  onOpenChange,
  onOpenDetail,
}: ConsultationCalendarDayListDialogProps) {
  const grouped = groupConsultationsByHour(consultations);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            {selectedDate && format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            <Badge variant="secondary" className="ml-2">{consultations.length}건</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-2">
            {Object.entries(grouped).map(([time, items]) => (
              <div key={time} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-700">{time}</span>
                  </div>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="space-y-2 pl-2">
                  {items.map((consultation) => {
                    const isDone = isFinishedConsultation(consultation.status);
                    const isLearning = consultation.consultation_type === 'learning';
                    return (
                      <button
                        key={consultation.id}
                        type="button"
                        className="w-full text-left"
                        onClick={() => onOpenDetail(consultation)}
                      >
                        <Card className={`transition-all hover:shadow-md ${
                          isLearning ? 'border-emerald-200 hover:bg-emerald-50/30' : 'hover:border-blue-300 hover:bg-blue-50/30'
                        } ${isDone ? 'opacity-60' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <i className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${getStatusDot(consultation.status, isLearning)}`} />
                                {isLearning && <UserCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />}
                                <span className={`truncate font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  {consultation.student_name}
                                </span>
                                <span className="text-sm text-gray-500">{consultation.student_grade}</span>
                                <ConsultationCalendarStatusBadge status={consultation.status} />
                                {isLearning && consultation.learning_type && (
                                  <Badge variant="outline" className="border-emerald-300 text-xs text-emerald-700">
                                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                                  </Badge>
                                )}
                              </div>
                              <span className="flex flex-shrink-0 items-center gap-1.5 text-sm text-gray-500">
                                <Phone className="h-3.5 w-3.5" />
                                {consultation.student_phone || consultation.parent_phone}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
