'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/features/pay-rules/pay-rule-utils';
import { openSalaryForPage } from './salaries-page-api';

interface SalaryOpenDialogProps {
  instructors: Array<{ id: number; name: string }>;
  defaultMonth?: string;
  onClose: () => void;
  onOpened: (salaryId: number) => void;
}

const selectClass = 'h-11 w-full rounded-xl border border-transparent bg-muted px-4 text-[15px] text-foreground outline-none focus-visible:border-primary';

/** 출근이 없는 달도 명세서를 만들어 금액을 직접 넣는다 */
export function SalaryOpenDialog({ instructors, defaultMonth, onClose, onOpened }: SalaryOpenDialogProps) {
  const [instructorId, setInstructorId] = useState(0);
  const [yearMonth, setYearMonth] = useState(defaultMonth ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!instructorId || !yearMonth) {
      toast.error('강사와 급여월을 골라 주세요.');
      return;
    }
    setSaving(true);
    try {
      const response = await openSalaryForPage(instructorId, yearMonth);
      onOpened(response.salary.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, '급여 명세서를 만들지 못했습니다. 잠시 후 다시 시도해주세요.'));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>명세서 만들기</DialogTitle>
          <DialogDescription>출근이 없는 달도 만들 수 있어요. 이미 있으면 그 명세서를 열어요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor="salary-open-instructor">강사</label>
            <select id="salary-open-instructor" className={selectClass} value={instructorId} onChange={(event) => setInstructorId(Number(event.target.value))}>
              <option value={0}>강사 선택</option>
              {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor="salary-open-month">급여월 (일한 달)</label>
            <Input id="salary-open-month" type="month" value={yearMonth} onChange={(event) => setYearMonth(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>취소</Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>{saving ? '여는 중' : '만들기'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
