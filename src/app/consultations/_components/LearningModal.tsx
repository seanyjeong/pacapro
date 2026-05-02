// consultations/_components/LearningModal.tsx
import { UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import type { LearningType } from '@/lib/types/consultation';
import { LEARNING_TYPE_LABELS } from '@/lib/types/consultation';
import type { LearningForm } from '../_types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  learningForm: LearningForm;
  setLearningForm: (f: LearningForm) => void;
  students: Array<{ id: number; name: string; grade: string }>;
  studentsLoading: boolean;
  submittingLearning: boolean;
  handleLearningSubmit: () => void;
}

export function LearningModal({
  open, onOpenChange,
  learningForm, setLearningForm,
  students, studentsLoading,
  submittingLearning, handleLearningSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            재원생 상담 등록
          </DialogTitle>
          <DialogDescription>
            기존 재원생의 상담 일정을 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div>
            <Label>학생 선택 *</Label>
            {studentsLoading ? (
              <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                학생 목록 로딩 중...
              </div>
            ) : (
              <Select
                value={learningForm.studentId}
                onValueChange={(v) => setLearningForm({ ...learningForm, studentId: v })}
              >
                <SelectTrigger><SelectValue placeholder="학생을 선택하세요" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} ({s.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>상담 날짜 *</Label>
              <Input
                type="date"
                value={learningForm.preferredDate}
                onChange={(e) => setLearningForm({ ...learningForm, preferredDate: e.target.value })}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <Label>상담 시간 *</Label>
              <Input
                type="time"
                value={learningForm.preferredTime}
                onChange={(e) => setLearningForm({ ...learningForm, preferredTime: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>상담 유형</Label>
            <Select
              value={learningForm.learningType}
              onValueChange={(v) => setLearningForm({ ...learningForm, learningType: v as LearningType })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEARNING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>메모</Label>
            <Textarea
              value={learningForm.adminNotes}
              onChange={(e) => setLearningForm({ ...learningForm, adminNotes: e.target.value })}
              placeholder="상담 관련 메모 (선택)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={handleLearningSubmit}
            disabled={submittingLearning}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submittingLearning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
