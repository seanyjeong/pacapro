import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonConfirmDialogProps {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  detail?: string;
  title: string;
  warning?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SeasonConfirmDialog({
  busy = false,
  confirmLabel,
  description,
  detail,
  onCancel,
  onConfirm,
  title,
  warning,
}: SeasonConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
      <section
        aria-labelledby="season-confirm-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-xl sm:rounded-2xl sm:pb-6"
        role="alertdialog"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="season-confirm-title" className="text-[17px] font-bold text-foreground">
              {title}
            </h2>
            <p className="mt-1 break-keep text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {detail ? (
          <p className="mt-4 rounded-xl bg-muted px-3 py-2.5 text-[15px] font-semibold text-foreground">
            {detail}
          </p>
        ) : null}

        {warning ? <p className="mt-3 break-keep rounded-xl bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning">{warning}</p> : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" disabled={busy} type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button className="w-full sm:w-auto" disabled={busy} type="button" variant="destructive" onClick={onConfirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
