'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: string;
  onRetry: () => void;
}

export function StaffPageError({ error, onRetry }: ErrorProps) {
  return (
    <section className="rounded-2xl bg-destructive-soft p-6 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
      <h2 className="mt-3 text-[17px] font-bold text-foreground">직원 정보를 불러오지 못했어요</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
      <Button onClick={onRetry} className="mt-4">다시 불러오기</Button>
    </section>
  );
}

export function StaffPageLoading() {
  return (
    <section className="rounded-2xl bg-card p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        직원 권한 정보를 불러오는 중입니다.
      </div>
      <div className="mt-5 space-y-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-12 rounded-xl bg-muted" />
        ))}
      </div>
    </section>
  );
}
