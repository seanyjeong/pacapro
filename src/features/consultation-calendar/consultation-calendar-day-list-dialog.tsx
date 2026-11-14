import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, FileText, Phone, UserCheck } from 'lucide-react';
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
import { CONSULTATION_TYPE_LABELS } from '@/features/student-consultations/student-consultation-utils';
import { ConsultationCalendarStatusBadge } from './consultation-calendar-status-badge';
import type { StudentConsultationMemo } from './consultation-calendar-types';
import { getStatusDot, groupConsultationsByHour, isFinishedConsultation } from './consultation-calendar-utils';

interface ConsultationCalendarDayListDialogProps {
  open: boolean;
  selectedDate: Date | null;
  consultations: Consultation[];
  memos: StudentConsultationMemo[];
  onOpenChange: (open: boolean) => void;
  onOpenDetail: (consultation: Consultation) => void;
}

// 학생 상세의 상담 기록 카드와 같은 이름으로 보여 준다.
const MEMO_FIELDS: Array<{ key: 'academic_memo' | 'physical_memo' | 'target_memo' | 'general_memo'; label: string }> = [
  { key: 'academic_memo', label: '학업' },
  { key: 'physical_memo', label: '실기' },
  { key: 'target_memo', label: '목표' },
  { key: 'general_memo', label: '종합 메모' },
];

export function ConsultationCalendarDayListDialog({
  open,
  selectedDate,
  consultations,
  memos,
  onOpenChange,
  onOpenDetail,
}: ConsultationCalendarDayListDialogProps) {
  const grouped = groupConsultationsByHour(consultations);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {selectedDate && format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            <Badge variant="secondary" className="ml-2">{consultations.length + memos.length}건</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-2">
            {Object.entries(grouped).map(([time, items]) => (
              <div key={time} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{time}</span>
                  </div>
                  <div className="flex-1 border-t border-border/60" />
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
                        <Card className={`bg-muted transition-colors ${
                          isLearning ? 'hover:bg-success-soft' : 'hover:bg-primary-soft'
                        } ${isDone ? 'opacity-60' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <i className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${getStatusDot(consultation.status, isLearning)}`} />
                                {isLearning && <UserCheck className="h-3.5 w-3.5 flex-shrink-0 text-success" />}
                                <span className={`truncate font-medium ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                  {consultation.student_name}
                                </span>
                                <span className="text-sm text-muted-foreground">{consultation.student_grade}</span>
                                <ConsultationCalendarStatusBadge status={consultation.status} />
                                {isLearning && consultation.learning_type && (
                                  <Badge variant="success">
                                    {LEARNING_TYPE_LABELS[consultation.learning_type]}
                                  </Badge>
                                )}
                              </div>
                              <span className="flex flex-shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
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
            {memos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1.5">
                    <FileText className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-warning">상담 메모</span>
                  </div>
                  <div className="flex-1 border-t border-border/60" />
                </div>
                <div className="space-y-2 pl-2">
                  {memos.map((memo) => (
                    <Card key={`memo-${memo.id}`} className="bg-warning-soft/60">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-foreground">{memo.student_name}</span>
                          <span className="text-sm text-muted-foreground">{memo.grade}</span>
                          <Badge variant="warning">
                            {CONSULTATION_TYPE_LABELS[memo.consultation_type] || memo.consultation_type}
                          </Badge>
                        </div>
                        {MEMO_FIELDS.filter((field) => memo[field.key]).map((field) => (
                          <p key={field.key} className="whitespace-pre-wrap text-sm text-secondary-foreground">
                            <span className="text-muted-foreground">{field.label}:</span> {memo[field.key]}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
