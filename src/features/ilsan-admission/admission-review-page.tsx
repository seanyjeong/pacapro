'use client';
import Link from 'next/link';
import { ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { useIlsanAdmissions } from '@/hooks/use-ilsan-admissions';
import { cn } from '@/lib/utils/cn';
import { AdmissionReviewDetail } from './admission-review-detail';
import { AdmissionReviewList } from './admission-review-list';
import { AdmissionCopyLinkButton } from './admission-copy-link-button';

export function AdmissionReviewPage() {
  const admissions=useIlsanAdmissions();
  const {applications,selected,nextCursor,loading,busy,error,select,refresh,loadMore}=admissions;
  return <div className="mx-auto w-full max-w-7xl space-y-4 break-keep">
    <PageHeader
      title="일산 입학원서"
      description="접수된 원서의 등록일·수업 요일·첫 달 학원비를 확인하고 재원 등록을 승인해요."
      actions={<div className="flex w-full flex-wrap items-start gap-2 md:w-auto">
        <AdmissionCopyLinkButton />
        <Link href="/admissions/ilsan" target="_blank" rel="noopener noreferrer" className={buttonVariants({variant:'outline',className:'flex-1 gap-2 md:flex-none'})}><ExternalLink className="h-4 w-4"/>원서 페이지</Link>
        <Button type="button" variant="outline" className="flex-1 gap-2 md:flex-none" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw className={cn('h-4 w-4',loading&&'animate-spin')}/>새로고침</Button>
      </div>}
    />
    {error && !selected && <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div className={cn('min-w-0 lg:sticky lg:top-20',selected&&'hidden lg:block')}>
        <AdmissionReviewList applications={applications} selectedId={selected?.id} loading={loading} hasMore={!!nextCursor} disabled={busy} onSelect={select} onLoadMore={()=>void loadMore()}/>
      </div>
      <div className={cn('min-w-0',!selected&&'hidden lg:block')}>
        {selected ? <AdmissionReviewDetail admissions={admissions}/> : <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl bg-card px-6 text-center text-sm text-muted-foreground">
          <ClipboardList className="h-8 w-8"/>왼쪽 목록에서 원서를 선택하면 등록 조건을 확인할 수 있습니다.
        </div>}
      </div>
    </div>
  </div>;
}
