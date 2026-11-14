'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { branchesAPI, type StudentPlacement, type TuitionChange } from '@/lib/api/branches';
import { TuitionChangeList } from './tuition-change-list';

const quiet = { suppressErrorToast: true };

export interface StudentMoveResult {
  moved: boolean; // false = 묻는 창에서 취소
  tuitionUpdated: number;
}

interface PendingMove {
  studentIds: number[];
  placement: StudentPlacement;
  changes: TuitionChange[];
  resolve: (result: StudentMoveResult) => void;
  reject: (error: unknown) => void;
}

/**
 * 학생 반 이동. 새 반(또는 지금 반)에 따로 정한 학원비 표가 있어 금액이 달라지는 학생이 있으면
 * "학원비도 바꿀까요?" 를 한 번에 묻고, 고른 학생만 바꾼다. 묻지 않거나 고르지 않으면 학원비는 그대로.
 * 반 표를 쓰지 않는 학원·반은 묻는 창 없이 지금처럼 바로 옮긴다.
 */
export function useStudentMove() {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const move = async (studentIds: number[], placement: StudentPlacement): Promise<StudentMoveResult> => {
    const { changes } = await branchesAPI.previewMoveTuition(studentIds, placement.class_id, quiet);
    if (changes.length === 0) {
      await branchesAPI.assignStudents(studentIds, placement, quiet);
      return { moved: true, tuitionUpdated: 0 };
    }
    setSelected(new Set(changes.map((change) => change.student_id)));
    return new Promise((resolve, reject) => setPending({ studentIds, placement, changes, resolve, reject }));
  };

  const finish = async (tuitionChanges: TuitionChange[] | null) => {
    if (!pending) return;
    if (tuitionChanges === null) {
      pending.resolve({ moved: false, tuitionUpdated: 0 });
      setPending(null);
      return;
    }
    setBusy(true);
    try {
      await branchesAPI.assignStudents(pending.studentIds, pending.placement, quiet, tuitionChanges);
      pending.resolve({ moved: true, tuitionUpdated: tuitionChanges.length });
    } catch (error) {
      pending.reject(error);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const chosen = pending ? pending.changes.filter((change) => selected.has(change.student_id)) : [];
  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) void finish(null); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>학원비도 바꿀까요?</DialogTitle>
          <DialogDescription className="break-keep">
            옮길 반의 학원비와 지금 금액이 다른 학생이에요. 고른 학생만 바꾸고, 할인율과 이미 만든 청구서는 그대로예요.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-3 sm:max-h-[52vh] sm:overflow-y-auto">
          {pending ? (
            <TuitionChangeList
              changes={pending.changes}
              selected={selected}
              onToggle={(id) => setSelected((current) => {
                const next = new Set(current);
                if (!next.delete(id)) next.add(id);
                return next;
              })}
            />
          ) : null}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={busy} onClick={() => void finish(null)}>
            취소
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void finish([])}>
            학원비는 그대로 두고 옮기기
          </Button>
          <Button type="button" className="w-full sm:w-auto" disabled={busy || chosen.length === 0} onClick={() => void finish(chosen)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {chosen.length}명 학원비도 바꾸기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { move, dialog };
}
