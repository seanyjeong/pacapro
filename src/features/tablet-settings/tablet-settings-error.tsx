import Link from 'next/link';
import { AlertCircle, Monitor, RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

interface TabletSettingsErrorProps {
  onRetry: () => void;
}

export function TabletSettingsError({ onRetry }: TabletSettingsErrorProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="rounded-md border border-border bg-background px-6 py-10 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600 dark:text-rose-300" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">설정 정보를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            다시 불러오기
          </Button>
          <Link href="/settings" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
            <Monitor className="h-4 w-4" />
            PC 설정 열기
          </Link>
        </div>
      </section>
    </div>
  );
}
