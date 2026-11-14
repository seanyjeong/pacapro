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
      <section className="rounded-2xl bg-card px-6 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive"><AlertCircle className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-bold text-foreground">{message}</h1>
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
