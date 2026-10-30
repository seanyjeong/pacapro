'use client';
import Link from 'next/link';
import { ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useIlsanAdmissions } from '@/hooks/use-ilsan-admissions';
import { cn } from '@/lib/utils/cn';
import { AdmissionReviewDetail } from './admission-review-detail';
import { AdmissionReviewList } from './admission-review-list';
import { AdmissionCopyLinkButton } from './admission-copy-link-button';

export function AdmissionReviewPage() {
  const admissions=useIlsanAdmissions();
  const {applications,selected,nextCursor,loading,busy,error,select,refresh,loadMore}=admissions;
  return <div className="mx-auto w-full max-w-7xl space-y-5 break-keep py-4 md:py-8">
    <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Ilsan Admissions</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">일산 입학원서</h1>
        <p className="mt-1 text-sm text-muted-foreground">접수된 원서의 등록일·수업 요일·첫 달 학원비를 확인하고 재원 등록을 승인합니다.</p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <AdmissionCopyLinkButton />
        <Link href="/admissions/ilsan" target="_blank" rel="noopener noreferrer" className={buttonVariants({variant:'outline',className:'flex-1 gap-2 md:flex-none'})}><ExternalLink className="h-4 w-4"/>원서 페이지</Link>
        <Button type="button" variant="outline" className="flex-1 gap-2 md:flex-none" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw className={cn('h-4 w-4',loading&&'animate-spin')}/>새로고침</Button>
      </div>
    </header>
    {error && !selected && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div className={cn('min-w-0 lg:sticky lg:top-20',selected&&'hidden lg:block')}>
        <AdmissionReviewList applications={applications} selectedId={selected?.id} loading={loading} hasMore={!!nextCursor} disabled={busy} onSelect={select} onLoadMore={()=>void loadMore()}/>
      </div>
      <div className={cn('min-w-0',!selected&&'hidden lg:block')}>
        {selected ? <AdmissionReviewDetail admissions={admissions}/> : <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card/50 px-6 text-center text-sm text-muted-foreground">
          <ClipboardList className="h-8 w-8"/>왼쪽 목록에서 원서를 선택하면 등록 조건을 확인할 수 있습니다.
        </div>}
      </div>
    </div>
  </div>;
}
