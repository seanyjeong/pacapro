import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { StudentDetailAction } from './student-detail-types';

interface StudentDetailActionDialogProps {
  action: StudentDetailAction | null;
  busy: boolean;
  open: boolean;
  studentName: string;
  unpaidPaymentCount: number;
  onConfirm: (action: StudentDetailAction, data: { reason?: string }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const ACTION_COPY = {
  delete: {
    confirmLabel: '삭제 실행',
    description: '삭제 후에는 학생 목록에서 보이지 않습니다. 필요한 기록을 먼저 확인해 주세요.',
    title: '학생 삭제',
  },
  graduate: {
    confirmLabel: '졸업 처리 완료',
    description: '학생 상태를 졸업으로 변경합니다. 납부와 상담 기록은 유지됩니다.',
    title: '졸업 처리',
  },
  withdraw: {
    confirmLabel: '퇴원 처리 완료',
    description: '학생 상태를 퇴원으로 변경합니다. 사유를 남기면 이후 확인이 쉽습니다.',
    title: '퇴원 처리',
  },
} satisfies Record<StudentDetailAction, { confirmLabel: string; description: string; title: string }>;

export function StudentDetailActionDialog({
  action,
  busy,
  open,
  studentName,
  unpaidPaymentCount,
  onConfirm,
  onOpenChange,
}: StudentDetailActionDialogProps) {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const copy = useMemo(() => (action ? ACTION_COPY[action] : null), [action]);

  useEffect(() => {
    if (!open) {
      setDeleteConfirm('');
      setWithdrawReason('');
    }
  }, [open]);

  if (!action || !copy) return null;

  const deleteReady = action !== 'delete' || deleteConfirm.trim() === '삭제';
  const confirmDisabled = busy || !deleteReady;

  const handleConfirm = async () => {
    await onConfirm(action, { reason: withdrawReason.trim() || undefined });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {studentName} 학생을 대상으로 진행합니다. {copy.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          {action === 'withdraw' && unpaidPaymentCount > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
              미납 학원비 {unpaidPaymentCount}건이 있습니다. 퇴원 전 납부 상태를 확인해 주세요.
            </div>
          ) : null}

          {action === 'withdraw' ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">퇴원 사유</span>
              <textarea
                aria-label="퇴원 사유"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="예: 타 학원 이동, 개인 사정"
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
              />
            </label>
          ) : null}

          {action === 'delete' ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">삭제 확인 입력</span>
              <input
                aria-label="삭제 확인 입력"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="삭제"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <Button
            className={action === 'delete' ? 'bg-rose-600 text-white hover:bg-rose-700' : undefined}
            disabled={confirmDisabled}
            type="button"
            onClick={handleConfirm}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {copy.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
