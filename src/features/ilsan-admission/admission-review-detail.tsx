'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, UserRound } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { useIlsanAdmissions } from '@/hooks/use-ilsan-admissions';
import { AdmissionReviewQuote, withWeekday } from './admission-review-quote';
import { AdmissionReviewTerms } from './admission-review-terms';
import { AdmissionReviewExisting } from './admission-review-existing';
import { AdmissionStatusBadge } from './admission-review-list';

const REVIEW_REASONS: Record<string,string> = {
  ENROLLMENT_OVERDUE: '등록 예정월이 지나 자동 등록하지 않았습니다. 등록일과 학원비를 다시 확인해 주세요.',
  QUOTE_CHANGED: '확정한 뒤 학원비 계산이 달라졌습니다. 다시 계산하고 승인해 주세요.',
  DUPLICATE_STUDENT: '같은 이름과 전화번호의 학생이 이미 있습니다. 기존 학생을 확인해 주세요.',
};
const GENDERS: Record<string,string> = {male:'남학생',female:'여학생'};

export function AdmissionReviewDetail({admissions}:{admissions:ReturnType<typeof useIlsanAdmissions>}) {
  const {selected,draft,preview,busy,error,notice,editable,canConfirm,today,changeTerms,calculate,confirm,cancel,refresh}=admissions;
  const [cancelOpen,setCancelOpen]=useState(false);
  if(!selected) return null;
  const profile=selected.profile;
  const parent=(who:'father'|'mother')=>{const name=profile[`${who}_name`],phone=profile[`${who}_phone`];return name||phone ? `${name||'성함 미입력'}${phone?` · ${phone}`:''}` : '미입력';};
  return <div className="space-y-4">
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
        <Button type="button" variant="ghost" size="icon-sm" className="-ml-1 mt-0.5 shrink-0 lg:hidden" aria-label="원서 목록으로" disabled={busy} onClick={()=>void refresh()}><ArrowLeft className="h-4 w-4"/></Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">{profile.name}</h2><AdmissionStatusBadge status={selected.status} completionKind={selected.completion_kind}/></div>
          <p className="mt-1 text-sm text-muted-foreground">{[profile.grade,profile.school,GENDERS[profile.gender]].filter(Boolean).join(' · ')}</p>
        </div>
        {selected.student_id && <Link href={`/students/${selected.student_id}`} className={buttonVariants({variant:'outline',size:'sm',className:'shrink-0 gap-1.5'})}><UserRound className="h-4 w-4"/>학생 보기</Link>}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {selected.status==='review' && <Banner tone="warn">{REVIEW_REASONS[selected.review_code ?? ''] ?? '등록 처리 중 확인이 필요한 항목이 있습니다. 조건을 다시 계산하고 승인해 주세요.'}</Banner>}
        {notice && <Banner tone="ok">{notice}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="생년월일 앞 6자리" value={profile.birth_six}/>
          <Info label="학생 전화번호" value={profile.phone}/>
          <Info label="아버님" value={parent('father')} tag={profile.primary_parent==='father'}/>
          <Info label="어머님" value={parent('mother')} tag={profile.primary_parent==='mother'}/>
          <Info label="희망 등록일" value={withWeekday(profile.enrollment_date)}/>
          <Info label="접수" value={selected.created_at.slice(0,16)}/>
        </dl>
      </div>
    </section>
    <AdmissionReviewExisting admissions={admissions}/>
    {selected.completion_kind==='fill_missing' && <Banner tone="ok">기존 학생의 빈 정보를 보완했습니다. 재원 상태·학원비·수업 배정은 유지했습니다.</Banner>}
    {editable && admissions.mode==='new' && draft && <AdmissionReviewTerms draft={draft} today={today} busy={busy} onChange={changeTerms} onCalculate={()=>void calculate()}/>}
    {admissions.mode==='new' && (preview ? <AdmissionReviewQuote title="계산 결과" quote={preview.quote} today={today} duplicates={preview.duplicate_student_ids} busy={busy} canConfirm={canConfirm} onConfirm={()=>void confirm()}/>
      : selected.quote ? <AdmissionReviewQuote title={selected.status==='enrolled'?'등록한 조건':'확정한 조건'} quote={selected.quote} today={today}/>
      : editable && <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">수업 요일과 월 학원비를 입력하고 <b className="font-medium text-foreground">일할 금액 확인</b>을 눌러 주세요.</p>)}
    {editable && <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={()=>setCancelOpen(true)}>{selected.status==='scheduled'?'등록 예약 취소':'원서 취소'}</Button></div>}
    {cancelOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="admission-cancel-title">
      <div className="mx-4 w-full max-w-sm rounded-md border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30"><AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300"/></div>
          <div><h3 id="admission-cancel-title" className="font-semibold">{profile.name} 원서 취소</h3><p className="text-sm text-muted-foreground">취소한 원서는 다시 승인할 수 없습니다.</p></div>
        </div>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">학생과 청구서는 생성되지 않습니다. 다시 등록하려면 새 원서를 받아야 합니다.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={()=>setCancelOpen(false)}>닫기</Button>
          <Button type="button" variant="destructive" onClick={()=>{setCancelOpen(false);void cancel();}}>원서 취소</Button>
        </div>
      </div>
    </div>}
  </div>;
}

function Info({label,value,tag}:{label:string;value:string;tag?:boolean}) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 break-all">{value}{tag && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">학원 안내</span>}</dd></div>;
}
function Banner({tone,children}:{tone:'ok'|'warn'|'error';children:React.ReactNode}) {
  const styles={ok:'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    warn:'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100',
    error:'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}[tone];
  const Icon=tone==='ok'?CheckCircle2:AlertTriangle;
  return <p role={tone==='ok'?'status':'alert'} className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm font-medium leading-6 ${styles}`}><Icon className="mt-0.5 h-4 w-4 shrink-0"/>{children}</p>;
}
