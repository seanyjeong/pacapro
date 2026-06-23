'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: string;
  onRetry: () => void;
}

export function StaffPageError({ error, onRetry }: ErrorProps) {
  return (
    <section className="rounded-md border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
      <h2 className="mt-3 text-lg font-semibold text-foreground">직원 정보를 불러오지 못했습니다</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
      <Button onClick={onRetry} className="mt-4 rounded-md">다시 불러오기</Button>
    </section>
  );
}

export function StaffPageLoading() {
  return (
    <section className="rounded-md border border-border bg-card p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        직원 권한 정보를 불러오는 중입니다.
      </div>
      <div className="mt-5 space-y-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-12 rounded-md bg-muted" />
        ))}
      </div>
    </section>
  );
}
