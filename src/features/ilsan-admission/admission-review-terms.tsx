import { Calculator, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMISSION_DAYS, ADMISSION_FIELD_CLASS } from '@/constants/ilsan-admission';
import type { AdmissionDraft } from '@/hooks/use-ilsan-admissions';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import { cn } from '@/lib/utils/cn';

const CLASS_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LABEL_CLASS = 'block text-sm font-medium text-foreground/80';
const toggleClass = (on:boolean) => cn('relative flex h-11 cursor-pointer select-none items-center justify-center rounded-md border text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
  on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-foreground hover:bg-muted');

interface Props {draft:AdmissionDraft;today:string;busy:boolean;onChange:(patch:Partial<AdmissionDraft>)=>void;onCalculate:()=>void}
export function AdmissionReviewTerms({draft,today,busy,onChange,onCalculate}:Props) {
  const toggleDay=(day:number)=>onChange({class_days:draft.class_days.includes(day)?draft.class_days.filter(d=>d!==day):[...draft.class_days,day].sort()});
  return <section className="rounded-md border border-border bg-card">
    <div className="border-b border-border px-4 py-3 sm:px-5"><h3 className="text-sm font-semibold">등록 조건</h3><p className="mt-0.5 text-xs text-muted-foreground">조건을 바꾸면 학원비를 다시 계산해야 승인할 수 있습니다.</p></div>
    <fieldset disabled={busy} className="min-w-0 space-y-5 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1"><label htmlFor="review-date" className={LABEL_CLASS}>등록일</label>
          <input id="review-date" type="date" min={today} className={cn(ADMISSION_FIELD_CLASS,'h-11')} value={draft.enrollment_date} onChange={e=>onChange({enrollment_date:e.target.value})}/></div>
        <div className="min-w-0 space-y-1.5"><label htmlFor="review-tuition" className={LABEL_CLASS}>월 학원비</label>
          <div className="relative"><input id="review-tuition" inputMode="numeric" placeholder="0" aria-label="월 학원비 (원)" className={cn(ADMISSION_FIELD_CLASS,'h-11 pr-9 text-right tabular-nums')} value={draft.monthly_tuition===''?'':draft.monthly_tuition.toLocaleString('ko-KR')} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,'');onChange({monthly_tuition:raw===''?'':Number(raw)});}}/>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span></div></div>
        <div className="min-w-0 space-y-1.5"><label htmlFor="review-discount" className={LABEL_CLASS}>할인율</label>
          <div className="relative"><input id="review-discount" inputMode="numeric" aria-label="할인율 (%)" className={cn(ADMISSION_FIELD_CLASS,'h-11 pr-9 text-right tabular-nums')} value={draft.discount_rate} onChange={e=>onChange({discount_rate:Math.min(100,Number(e.target.value.replace(/[^0-9]/g,''))||0)})}/>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></div></div>
      </div>
      <div className="space-y-1.5"><p className={LABEL_CLASS} id="review-days">수업 요일</p>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-labelledby="review-days">
          {CLASS_DAY_ORDER.map(day=><label key={day} className={toggleClass(draft.class_days.includes(day))}><input type="checkbox" className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed" checked={draft.class_days.includes(day)} onChange={()=>toggleDay(day)}/>{ADMISSION_DAYS[day]}</label>)}
        </div></div>
      <div className="space-y-1.5"><p className={LABEL_CLASS} id="review-slot">수업 시간대</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby="review-slot">
          {(Object.keys(TIME_SLOT_LABELS) as Array<keyof typeof TIME_SLOT_LABELS>).map(slot=><label key={slot} className={toggleClass(draft.time_slot===slot)}><input type="radio" name="review-slot" className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed" checked={draft.time_slot===slot} onChange={()=>onChange({time_slot:slot})}/>{TIME_SLOT_LABELS[slot]}</label>)}
        </div></div>
      <Button type="button" variant="outline" className="h-11 w-full gap-2 sm:w-auto" onClick={onCalculate}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Calculator className="h-4 w-4"/>}일할 금액 확인</Button>
    </fieldset>
  </section>;
}
