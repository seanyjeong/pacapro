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
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            {selectedDate && format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            <Badge variant="secondary" className="ml-2">{consultations.length + memos.length}건</Badge>
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
            {memos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold text-amber-700">상담 메모</span>
                  </div>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="space-y-2 pl-2">
                  {memos.map((memo) => (
                    <Card key={`memo-${memo.id}`} className="border-amber-200">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-gray-900">{memo.student_name}</span>
                          <span className="text-sm text-gray-500">{memo.grade}</span>
                          <Badge variant="outline" className="border-amber-300 text-xs text-amber-700">
                            {CONSULTATION_TYPE_LABELS[memo.consultation_type] || memo.consultation_type}
                          </Badge>
                        </div>
                        {MEMO_FIELDS.filter((field) => memo[field.key]).map((field) => (
                          <p key={field.key} className="whitespace-pre-wrap text-sm text-gray-600">
                            <span className="text-gray-500">{field.label}:</span> {memo[field.key]}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
