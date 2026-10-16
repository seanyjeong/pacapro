import { Inbox, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ADMISSION_STATUSES } from '@/constants/ilsan-admission';
import type { AdmissionApplication } from '@/lib/types/ilsan-admission';
import { cn } from '@/lib/utils/cn';

const STATUS_VARIANTS = {submitted:'info',review:'warning',scheduled:'soft',enrolled:'success',cancelled:'secondary'} as const;
export function AdmissionStatusBadge({status}:{status:AdmissionApplication['status']}) {
  return <Badge variant={STATUS_VARIANTS[status]} className="shrink-0 whitespace-nowrap">{ADMISSION_STATUSES[status]}</Badge>;
}

interface Props {applications:AdmissionApplication[];selectedId?:number;loading:boolean;hasMore:boolean;disabled:boolean;onSelect:(application:AdmissionApplication)=>void;onLoadMore:()=>void}
export function AdmissionReviewList({applications,selectedId,loading,hasMore,disabled,onSelect,onLoadMore}:Props) {
  return <section className="overflow-hidden rounded-md border border-border bg-card">
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold">접수 원서</h2>
      <span className="text-xs text-muted-foreground">{applications.length}건</span>
    </div>
    {!applications.length ? <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground" aria-busy={loading}>
      {loading ? <><Loader2 className="h-6 w-6 animate-spin"/>원서를 불러오는 중입니다.</> : <><Inbox className="h-7 w-7"/>접수된 원서가 없습니다.</>}
    </div> : <ul className="divide-y divide-border lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
      {applications.map(application=>{const active=application.id===selectedId,profile=application.profile;return <li key={application.id}>
        <button type="button" disabled={disabled} aria-current={active||undefined} onClick={()=>onSelect(application)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',active&&'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-primary/5')}>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2"><span className="truncate font-semibold">{profile.name}</span><span className="shrink-0 text-xs text-muted-foreground">{profile.grade}</span></span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">{profile.school}</span>
            <span className="mt-1.5 block text-xs text-muted-foreground">{application.status==='scheduled'&&application.enrollment_date ? `등록 예정 ${application.enrollment_date}` : `희망 ${profile.enrollment_date}`} · 접수 {application.created_at.slice(0,16)}</span>
          </span>
          <AdmissionStatusBadge status={application.status}/>
        </button>
      </li>;})}
    </ul>}
    {hasMore && <div className="border-t border-border p-2"><Button type="button" variant="ghost" className="w-full" disabled={loading||disabled} onClick={onLoadMore}>{loading?'불러오는 중…':'원서 더 보기'}</Button></div>}
  </section>;
}
