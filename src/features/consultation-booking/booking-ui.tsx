import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

/** 단계 화면 아래에 붙는 버튼 줄. 휴대폰에서 긴 입력 중에도 다음·이전 버튼이 늘 보이게 화면 아래에 붙는다. */
export function BookingActionBar({ children, error }: { children: ReactNode; error?: string | null }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {error && <BookingAlert message={error} />}
      {children}
    </div>
  );
}

export function BookingAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0">{message}</p>
    </div>
  );
}

export function BookingCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6">
      {title && <h2 className="mb-4 text-[17px] font-bold tracking-tight text-foreground">{title}</h2>}
      {children}
    </section>
  );
}
