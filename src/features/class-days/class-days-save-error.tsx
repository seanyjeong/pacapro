import { AlertCircle } from 'lucide-react';

interface ClassDaysSaveErrorProps {
  message: string | null;
}

export function ClassDaysSaveError({ message }: ClassDaysSaveErrorProps) {
  if (!message) return null;

  return (
    <section
      className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">저장 실패</h2>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    </section>
  );
}
