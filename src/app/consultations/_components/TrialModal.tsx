// consultations/_components/TrialModal.tsx
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Consultation } from '@/lib/types/consultation';
import type { TrialDate } from '../_types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultation: Consultation | null;
  trialDates: TrialDate[];
  setTrialDates: (d: TrialDate[]) => void;
  convertingToTrial: boolean;
  addTrialDate: () => void;
  removeTrialDate: (i: number) => void;
  handleConvertToTrial: () => void;
}

export function TrialModal({
  open, onOpenChange, consultation,
  trialDates, setTrialDates,
  convertingToTrial, addTrialDate, removeTrialDate,
  handleConvertToTrial,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>체험 수업 일정 선택</DialogTitle>
          <DialogDescription>
            {consultation?.student_name}님의 체험 수업 일정을 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6 px-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>체험 일정 ({trialDates.length}회)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTrialDate}>
                <Plus className="h-4 w-4 mr-1" />
                추가
              </Button>
            </div>
            {trialDates.map((trialDate, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-8">{index + 1}회</span>
                <Input
                  type="date"
                  value={trialDate.date}
                  onChange={(e) => {
                    const newDates = [...trialDates];
                    newDates[index] = { ...newDates[index], date: e.target.value };
                    setTrialDates(newDates);
                  }}
                  className="flex-1"
                />
                <Select
                  value={trialDate.timeSlot}
                  onValueChange={(v) => {
                    const newDates = [...trialDates];
                    newDates[index] = { ...newDates[index], timeSlot: v };
                    setTrialDates(newDates);
                  }}
                >
                  <SelectTrigger className="w-24">
                    <span>
                      {trialDate.timeSlot === 'morning' ? '오전' :
                       trialDate.timeSlot === 'afternoon' ? '오후' :
                       trialDate.timeSlot === 'evening' ? '저녁' : '시간대'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">오전</SelectItem>
                    <SelectItem value="afternoon">오후</SelectItem>
                    <SelectItem value="evening">저녁</SelectItem>
                  </SelectContent>
                </Select>
                {trialDates.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTrialDate(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            체험 학생으로 등록되면:
            <ul className="mt-1 ml-4 list-disc">
              <li>학생 관리에 체험생으로 추가됩니다</li>
              <li>출석 체크 시 체험 횟수가 차감됩니다</li>
              <li>체험 완료 후 정식 등록을 권유합니다</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleConvertToTrial} disabled={convertingToTrial}>
            {convertingToTrial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            체험 학생 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
