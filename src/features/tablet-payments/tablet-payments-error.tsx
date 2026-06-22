import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

interface TabletPaymentsErrorProps {
  detail: string;
  message: string;
  onRetry: () => void;
}

export function TabletPaymentsError({ detail, message, onRetry }: TabletPaymentsErrorProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <section className="rounded-md border border-border bg-background px-6 py-10 text-center shadow-none">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600 dark:text-rose-300" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">{message}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            다시 불러오기
          </Button>
          <Link href="/tablet/students" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            학생으로 이동
          </Link>
        </div>
      </section>
    </div>
  );
}
