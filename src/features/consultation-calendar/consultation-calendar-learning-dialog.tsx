import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LearningType } from '@/lib/types/consultation';
import { LEARNING_TYPE_LABELS } from '@/lib/types/consultation';
import { LEARNING_TIME_OPTIONS } from './consultation-calendar-constants';
import type { CalendarStudent, LearningConsultationForm } from './consultation-calendar-types';

interface ConsultationCalendarLearningDialogProps {
  open: boolean;
  date: Date | null;
  students: CalendarStudent[];
  studentsLoading: boolean;
  form: LearningConsultationForm;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: <K extends keyof LearningConsultationForm>(field: K, value: LearningConsultationForm[K]) => void;
  onLearningTypeChange: (value: LearningType) => void;
  onSubmit: () => void;
}

export function ConsultationCalendarLearningDialog({
  open,
  date,
  students,
  studentsLoading,
  form,
  submitting,
  onOpenChange,
  onFormChange,
  onLearningTypeChange,
  onSubmit,
}: ConsultationCalendarLearningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            재원생 상담 등록
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="flex items-center gap-2 text-sm text-emerald-800">
              <CalendarIcon className="h-4 w-4" />
              {date && format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>학생 선택 *</Label>
            {studentsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                학생 목록 로딩중...
              </div>
            ) : (
              <Select value={form.studentId} onValueChange={(value) => onFormChange('studentId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="학생을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.name} ({student.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>상담 시간 *</Label>
            <Select value={form.preferredTime} onValueChange={(value) => onFormChange('preferredTime', value)}>
              <SelectTrigger>
                <SelectValue placeholder={form.preferredTime} />
              </SelectTrigger>
              <SelectContent>
                {LEARNING_TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>상담 유형 *</Label>
            <Select value={form.learningType} onValueChange={(value) => onLearningTypeChange(value as LearningType)}>
              <SelectTrigger>
                <SelectValue placeholder={LEARNING_TYPE_LABELS[form.learningType]} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEARNING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>메모 (선택)</Label>
            <Input
              placeholder="상담 메모를 입력하세요"
              value={form.adminNotes}
              onChange={(event) => onFormChange('adminNotes', event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !form.studentId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                등록중...
              </>
            ) : (
              '등록'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
