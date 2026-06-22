'use client';

import { BellRing, CheckCircle2, Radio, Send } from 'lucide-react';

interface Props {
  isEnabled: boolean;
  logCount: number;
  senderCount: number;
  serviceLabel: string;
}

export default function NotificationsHeader({ isEnabled, logCount, senderCount, serviceLabel }: Props) {
  return (
    <header className="rounded-md border border-border bg-card px-5 py-4 shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Notification Desk</p>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">알림톡 및 SMS 설정</h1>
            <p className="mt-1 text-sm text-muted-foreground">발송 채널, 자동 알림, 템플릿, 최근 발송 상태를 한 화면에서 관리합니다.</p>
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[440px]">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="h-4 w-4" />
              <span>채널</span>
            </div>
            <p className="mt-1 font-semibold text-foreground">{serviceLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>상태</span>
            </div>
            <p className={isEnabled ? 'mt-1 font-semibold text-green-700 dark:text-green-300' : 'mt-1 font-semibold text-amber-700 dark:text-amber-300'}>
              {isEnabled ? '발송 가능' : '비활성'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Send className="h-4 w-4" />
              <span>발신/내역</span>
            </div>
            <p className="mt-1 font-semibold text-foreground">{senderCount}개 / {logCount}건</p>
          </div>
        </div>
      </div>
    </header>
  );
}
