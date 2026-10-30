import Link from 'next/link';
import { AlertTriangle, CalendarCheck2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMISSION_DAYS } from '@/constants/ilsan-admission';
import type { AdmissionQuote } from '@/lib/types/ilsan-admission';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import type { TimeSlot } from '@/lib/types/schedule';

export const won = (amount:number) => `${amount.toLocaleString('ko-KR')}원`;
export const withWeekday = (date:string) => `${date} (${ADMISSION_DAYS[new Date(`${date}T00:00:00`).getDay()]})`;

interface Props {quote:AdmissionQuote;title:string;today:string;duplicates?:number[];busy?:boolean;canConfirm?:boolean;onConfirm?:()=>void}
export function AdmissionReviewQuote({quote,title,today,duplicates=[],busy,canConfirm,onConfirm}:Props) {
  const immediate=quote.enrollment_date===today;
  return <section className="overflow-hidden rounded-md border border-border bg-card">
    <div className="border-b border-border px-4 py-3 sm:px-5"><h3 className="text-sm font-semibold">{title}</h3></div>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 rounded-md bg-muted/50 p-4 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-muted-foreground">등록일</p><p className="mt-1 text-lg font-semibold tabular-nums">{withWeekday(quote.enrollment_date)}</p></div>
        <div className="sm:text-right"><p className="text-xs font-medium text-muted-foreground">첫 달 청구 금액</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary">{won(quote.final_amount)}</p></div>
      </div>
      <dl className="divide-y divide-border text-sm">
        <QuoteRow label="수업" value={`${[1,2,3,4,5,6,0].filter(d=>quote.class_days.includes(d)).map(d=>ADMISSION_DAYS[d]).join('·')} · ${TIME_SLOT_LABELS[quote.time_slot as TimeSlot] ?? quote.time_slot}`}/>
        <QuoteRow label="월 학원비" value={won(quote.monthly_tuition)}/>
        <QuoteRow label={`${quote.year_month.slice(0,4)}년 ${Number(quote.year_month.slice(5))}월 수업`} value={`${quote.total_classes}회 중 ${quote.remaining_classes}회 수강`}/>
        <QuoteRow label="일할 금액" hint={`${won(quote.monthly_tuition)} × ${quote.remaining_classes}/${quote.total_classes}회`} value={won(quote.prorated_amount)}/>
        {quote.discount_amount>0 && <QuoteRow label={`할인 ${quote.discount_rate}%`} value={`− ${won(quote.discount_amount)}`}/>}
        <QuoteRow label="첫 달 학원비" value={won(quote.final_amount)} strong/>
      </dl>
      <div><p className="mb-2 text-xs font-medium text-muted-foreground">수업 날짜</p>
        {quote.class_dates.length ? <ul className="flex flex-wrap gap-1.5">{quote.class_dates.map(date=><li key={date} className="rounded border border-border bg-background px-2 py-1 text-xs tabular-nums">{date.slice(5).replace('-','/')} {ADMISSION_DAYS[new Date(`${date}T00:00:00`).getDay()]}</li>)}</ul>
          : <p className="text-sm text-muted-foreground">해당 월에 남은 수업이 없습니다.</p>}
        <p className="mt-2 text-xs leading-5 text-muted-foreground">선택한 요일 기준이며 공휴일·교육원 휴무는 별도 차감하지 않습니다. 금액은 천원 미만 버림입니다.</p></div>
      {duplicates.length>0 && <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0"/>같은 이름과 전화번호의 학생이 이미 있습니다</p>
        <p className="mt-1 leading-6">기존 학생을 확인한 뒤 처리해 주세요. 이 상태에서는 승인할 수 없습니다.</p>
        <div className="mt-2 flex flex-wrap gap-2">{duplicates.map(id=><Link key={id} href={`/students/${id}`} className="font-medium underline underline-offset-4">학생 #{id} 보기</Link>)}</div>
      </div>}
      {onConfirm && <div className="space-y-2 border-t border-border pt-4">
        <Button type="button" className="h-12 w-full gap-2 text-base font-semibold" disabled={!canConfirm} onClick={onConfirm}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CalendarCheck2 className="h-4 w-4"/>}{immediate?'확인하고 오늘 재원 등록':`확인하고 ${quote.enrollment_date} 등록 예약`}</Button>
        <p className="text-center text-xs leading-5 text-muted-foreground">{immediate?'승인하면 바로 학생과 첫 달 청구서가 만들어집니다.':'등록일이 되면 학생·첫 달 청구서·수업 배정이 자동으로 만들어집니다.'}</p>
      </div>}
    </div>
  </section>;
}

function QuoteRow({label,value,hint,strong}:{label:string;value:string;hint?:string;strong?:boolean}) {
  return <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-muted-foreground">{label}{hint && <span className="mt-0.5 block text-xs tabular-nums">{hint}</span>}</dt><dd className={strong?'font-semibold tabular-nums':'tabular-nums'}>{value}</dd></div>;
}
