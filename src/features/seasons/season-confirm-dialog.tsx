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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <section
        aria-labelledby="season-confirm-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-md border border-border bg-background p-5 shadow-xl"
        role="alertdialog"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="season-confirm-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 break-keep text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {detail ? (
          <p className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
            {detail}
          </p>
        ) : null}

        {warning ? <p className="mt-3 break-keep text-xs text-amber-700 dark:text-amber-300">{warning}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={busy} type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button disabled={busy} type="button" variant="destructive" onClick={onConfirm}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
