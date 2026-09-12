import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

interface MobileCalendarShellProps {
  title: string;
  description: string;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  onRetry: () => void;
  children: ReactNode;
}

export function MobileCalendarShell(props: MobileCalendarShellProps) {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background text-foreground sm:-my-8">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-3">
        <Link href="/m" aria-label="모바일 홈으로 이동" className={buttonVariants({ variant: 'ghost', size: 'icon' })}><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">{props.title}</h1>
          <p className="text-xs text-muted-foreground">{props.description}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="일정 새로고침" disabled={props.loading} onClick={props.onRetry}><RefreshCw className="h-4 w-4" /></Button>
      </header>
      <div className="space-y-4 px-3 py-4">
        {props.loading && <p role="status" className="text-sm text-muted-foreground">일정을 불러오는 중입니다.</p>}
        {props.error && (
          <div role="alert" className="space-y-2 rounded-lg border border-border bg-card p-4">
            <p className="text-sm">{props.errorMessage}</p>
            <Button variant="outline" onClick={props.onRetry}>다시 시도</Button>
          </div>
        )}
        {props.children}
      </div>
    </div>
  );
}
