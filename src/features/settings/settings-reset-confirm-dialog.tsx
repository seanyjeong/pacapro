import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SETTINGS_RESET_COPY, SETTINGS_RESET_TARGETS } from './settings-reset-copy';

interface SettingsResetConfirmDialogProps {
  isResetting: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function SettingsResetConfirmDialog({
  isResetting,
  open,
  onConfirm,
  onOpenChange,
}: SettingsResetConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{SETTINGS_RESET_COPY.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {SETTINGS_RESET_COPY.dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
            <p className="font-semibold">삭제되는 정보</p>
            <ul className="mt-2 space-y-1">
              {SETTINGS_RESET_TARGETS.map((target) => (
                <li key={target}>- {target}</li>
              ))}
            </ul>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              className="gap-2 bg-destructive hover:bg-destructive/90"
            >
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isResetting ? '초기화 중' : '초기화'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
