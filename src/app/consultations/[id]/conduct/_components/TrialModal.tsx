'use client';

import { Loader2, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { TrialDate } from '../_types';

interface TrialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string | undefined;
  trialDates: TrialDate[];
  setTrialDates: (dates: TrialDate[]) => void;
  convertingToTrial: boolean;
  onAddDate: () => void;
  onRemoveDate: (index: number) => void;
  onConvert: () => void;
}

export function TrialModal({
  open, onOpenChange, studentName, trialDates, setTrialDates,
  convertingToTrial, onAddDate, onRemoveDate, onConvert
}: TrialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>체험 학생 등록</DialogTitle>
          <DialogDescription>
            {studentName}님의 체험 수업 일정을 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6 px-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>체험 일정 ({trialDates.length}회)</Label>
              <Button type="button" variant="outline" size="sm" onClick={onAddDate}>
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
                    <span>{trialDate.timeSlot || '시간대'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="오전">오전</SelectItem>
                    <SelectItem value="오후">오후</SelectItem>
                    <SelectItem value="저녁">저녁</SelectItem>
                  </SelectContent>
                </Select>
                {trialDates.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveDate(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onConvert} disabled={convertingToTrial} className="bg-green-600 hover:bg-green-700">
            {convertingToTrial ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            체험 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
