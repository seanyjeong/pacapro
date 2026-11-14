'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatTile } from '@/components/ui/page';
import { branchesAPI, defaultTuitionSelection, type TuitionChange } from '@/lib/api/branches';
import { getSettingsSaveErrorMessage } from '@/features/settings/settings-error-message';
import { TuitionChangeList } from './tuition-change-list';

const quiet = { suppressErrorToast: true };

interface ClassTuitionApplyDialogProps {
  classId: number;
  label: string; // "수성 정시반"
  onClose: () => void;
  onApplied: () => void;
}

/**
 * 반 학원비 적용: 그 반 학생별 지금 → 새 금액 미리보기 → 고른 학생만 한꺼번에 바꾼다.
 * 할인율은 그대로, 이미 만든 청구서는 그대로(다음 청구부터 새 금액).
 */
export function ClassTuitionApplyDialog({ classId, label, onClose, onApplied }: ClassTuitionApplyDialogProps) {
  const [students, setStudents] = useState<TuitionChange[] | null>(null);
  const [ownTable, setOwnTable] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    branchesAPI.previewClassTuition(classId, quiet)
      .then((preview) => {
        if (cancelled) return;
        setStudents(preview.students);
        setOwnTable(preview.class.tuition_by_weekly !== null);
        setSelected(defaultTuitionSelection(preview.students));
      })
      .catch((err) => { if (!cancelled) setError(getSettingsSaveErrorMessage(err)); });
    return () => { cancelled = true; };
  }, [classId]);

  const changing = students?.filter((item) => item.changed) ?? [];
  const chosen = changing.filter((item) => selected.has(item.student_id));

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await branchesAPI.applyClassTuition(classId, chosen, quiet);
      toast.success(result.message);
      onApplied();
    } catch (err) {
      setError(getSettingsSaveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label} 학원비 적용</DialogTitle>
          <DialogDescription className="break-keep">
            {ownTable ? '이 반 학원비 표' : '학원 기본 학원비 표'}로 학생 학원비를 다시 맞춰요. 할인율은 그대로예요.
            이번 달부터 미납 월 청구도 같이 바뀌고, 낸 청구·일할 청구는 그대로예요. 개별 금액 학생은 처음엔 고르지 않아요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-3">
          {error && <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
          {students === null && !error ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />학생별 금액을 계산하는 중이에요.</p>
          ) : null}
          {students ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="바뀌는 학생" value={`${changing.length}명`} className="bg-muted p-4" />
                <StatTile label="그대로인 학생" value={`${students.length - changing.length}명`} className="bg-muted p-4" />
              </div>
              {students.length === 0 ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">이 반에 학원비를 바꿀 학생이 없어요.</p>
              ) : (
                <div className="sm:max-h-[48vh] sm:overflow-y-auto">
                  <TuitionChangeList
                    changes={students}
                    selected={selected}
                    onToggle={(id) => setSelected((current) => {
                      const next = new Set(current);
                      if (!next.delete(id)) next.add(id);
                      return next;
                    })}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={onClose}>닫기</Button>
          <Button type="button" className="w-full sm:w-auto" disabled={busy || chosen.length === 0} onClick={() => void apply()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {chosen.length}명 학원비 바꾸기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
