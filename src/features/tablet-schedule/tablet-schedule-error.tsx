import Link from 'next/link';
import { AlertCircle, CalendarCog, RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

interface TabletScheduleErrorProps {
  onRetry: () => void;
}

export function TabletScheduleError({ onRetry }: TabletScheduleErrorProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <section className="rounded-2xl bg-card px-6 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive"><AlertCircle className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-bold text-foreground">수업 정보를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            다시 불러오기
          </Button>
          <Link href="/students/class-days" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
            <CalendarCog className="h-4 w-4" />
            수업일관리
          </Link>
        </div>
      </section>
    </div>
  );
}
