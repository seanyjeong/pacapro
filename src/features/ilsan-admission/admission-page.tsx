'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { CalendarCheck2, CheckCircle2, Loader2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EMPTY_ADMISSION } from '@/constants/ilsan-admission';
import { submitAdmission } from '@/lib/api/ilsan-admissions';
import type { AdmissionProfile } from '@/lib/types/ilsan-admission';
import { AdmissionInput } from './admission-input';
import { AdmissionProfileFields } from './admission-profile-fields';
import { AdmissionSection } from './admission-section';

const ADMISSION_FLOW = ['원서 제출', '담당자 확인', '등록일부터 수강'];

export function AdmissionPage() {
  const [profile,setProfile]=useState<AdmissionProfile>({...EMPTY_ADMISSION});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
  const submission=useRef({body:'',key:''});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  const change=(field:keyof AdmissionProfile,value:string|boolean)=>{setProfile(p=>({...p,[field]:value}));setError('');};
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    const body=JSON.stringify(profile);
    if(submission.current.body!==body) submission.current={body,key:crypto.randomUUID()};
    try {const result=await submitAdmission(profile,submission.current.key);setReceipt(result.receipt);setProfile({...EMPTY_ADMISSION});}
    catch(cause){setError(cause instanceof Error ? cause.message : '접수하지 못했습니다. 다시 시도해 주세요.');}
    finally{setBusy(false);}
  }
  return <div className="min-h-screen break-keep bg-muted/50 text-foreground"><div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-10">
    <header className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm">
      <div className="px-5 pb-6 pt-7 text-center sm:px-8 sm:pt-9">
        <Image src="/brand/ilsan-max.png" alt="일산 맥스" width={800} height={478} priority className="mx-auto h-auto w-36 sm:w-44"/>
        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">일산 맥스 입학원서</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">학생과 보호자 정보를 남겨 주세요.<br/>담당자가 수업 일정과 첫 달 학원비를 확인한 뒤, 확정한 등록일부터 수강이 시작됩니다.</p>
      </div>
      <ol className="grid grid-cols-3 border-t border-white/10 bg-white/[0.04] text-center text-xs sm:text-sm">
        {ADMISSION_FLOW.map((label,index)=>{const current=index===(receipt?1:0);return <li key={label} aria-current={current?'step':undefined} className="flex flex-col items-center gap-1.5 px-1 py-3.5 sm:flex-row sm:justify-center sm:gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${current?'bg-red-600 text-white':'bg-white/15 text-slate-200'}`}>{index+1}</span>
          <span className={current?'font-semibold text-white':'text-slate-300'}>{label}</span>
        </li>;})}
      </ol>
    </header>
    {receipt ? <section role="status" className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"><CheckCircle2 className="h-6 w-6" aria-hidden="true"/></div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">입학원서를 접수했습니다</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">일산 교육원 담당자가 원서를 확인합니다.</p>
        <div className="mt-5 rounded-md border border-dashed border-border bg-muted/50 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">접수번호</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold">{receipt}</p>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <ReceiptNote icon={<CalendarCheck2 className="h-4 w-4"/>} title="등록일 확정" text="등록일과 학원비는 담당자 확인 후 확정됩니다."/>
        <ReceiptNote icon={<WalletCards className="h-4 w-4"/>} title="결제 안내" text="이 페이지에서 결제되거나 바로 재원 등록되지 않습니다."/>
      </div>
    </section> : <form className="space-y-5" onSubmit={submit}>
      <AdmissionProfileFields value={profile} onChange={change}/>
      <AdmissionSection step={3} title="등록 희망일">
        <AdmissionInput id="admission-date" label="수강을 시작하고 싶은 날짜" type="date" required min={today} value={profile.enrollment_date} onChange={e=>change('enrollment_date',e.target.value)} help="담당자가 수업 요일과 월 수강료를 정한 뒤, 남은 수업 횟수로 첫 달 학원비를 계산합니다."/>
      </AdmissionSection>
      <div className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted/50 p-3.5 text-sm leading-6">
          <input className="mt-0.5 h-5 w-5 shrink-0 accent-primary" type="checkbox" required checked={profile.consent} onChange={e=>change('consent',e.target.checked)}/>
          <span>입학 상담과 학생 등록을 위해 위 정보를 일산 맥스체대입시에 제공하는 데 동의합니다.</span>
        </label>
        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full gap-2 text-base font-semibold">{busy&&<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>}{busy?'원서를 접수하고 있습니다…':'입학원서 제출'}</Button>
      </div>
    </form>}
    <footer className="pb-4 pt-2 text-center text-xs text-muted-foreground">일산 맥스체대입시 · P-ACA</footer>
  </div></div>;
}

function ReceiptNote({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) {
  return <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">{icon}</span>
    <span className="min-w-0"><span className="block font-medium">{title}</span><span className="mt-0.5 block text-muted-foreground">{text}</span></span>
  </div>;
}
