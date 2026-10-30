'use client';
import { Button } from '@/components/ui/button';
import { ADMISSION_FIELD_CLASS } from '@/constants/ilsan-admission';
import type { useIlsanAdmissions } from '@/hooks/use-ilsan-admissions';
import { STATUS_LABELS, type StudentStatus } from '@/lib/types/student';
import { AdmissionReviewQuote } from './admission-review-quote';
import { AdmissionReviewTerms } from './admission-review-terms';

export function AdmissionReviewExisting({admissions:a}:{admissions:ReturnType<typeof useIlsanAdmissions>}) {
  if(!a.editable || !a.existingStudents.length)return null;
  const p=a.existingPreview,immediate=p?.quote?.enrollment_date===a.today;
  return <section className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-5">
    <h3 className="font-semibold">같은 이름의 기존 학생이 있습니다</h3>
    <label className="block text-sm">처리 방법
      <select aria-label="처리 방법" className={ADMISSION_FIELD_CLASS} value={a.mode} disabled={a.busy} onChange={e=>a.changeMode(e.target.value as 'new'|'existing')}>
        <option value="existing">기존 학생에 원서 내용 반영</option>
        <option value="new">다른 사람임을 확인하고 신규 등록</option>
      </select>
    </label>
    {a.mode==='existing' && <>
      <p className="text-sm text-muted-foreground">미등록·체험·퇴원·졸업 학생은 이 화면에서 요일·학원비를 정해 재원 등록합니다. 재원·휴원 학생은 정보만 바꿉니다. 동명이인이면 전화번호·학교를 확인해 선택해 주세요.</p>
      <label className="block text-sm">기존 학생
        <select aria-label="기존 학생" className={ADMISSION_FIELD_CLASS} value={a.existingStudentId ?? ''} disabled={a.busy} onChange={e=>a.chooseExisting(e.target.value?Number(e.target.value):null)}>
          <option value="">학생을 선택해 주세요</option>
          {a.existingStudents.map(s=><option key={s.id} value={s.id}>{s.name} · {STATUS_LABELS[s.status as StudentStatus] ?? s.status} · {s.student_number||`학생 ${s.id}`} · {s.phone||'전화 미입력'} · {s.school||'학교 미입력'} {s.grade}</option>)}
        </select>
      </label>
      <Button type="button" disabled={a.busy||!a.existingStudentId} onClick={()=>void a.checkExistingFields()}>원서와 비교</Button>
      {p && <>
        <ul className="space-y-2 text-sm" aria-label="원서 반영 미리보기">
          {p.fields.map(f=><li key={f.field}>{f.action==='replace'
            ? <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={a.replaceFields.includes(f.field)} disabled={a.busy} onChange={e=>a.toggleReplace(f.field,e.target.checked)}/><span><b>{f.label}</b>: {f.current} → {f.incoming} (원서 값으로 바꾸기)</span></label>
            : <><b>{f.label}</b>: {f.action==='fill'?`미입력 → ${f.incoming} (추가)`:`${f.current||'미입력'} (유지)`}</>}</li>)}
        </ul>
        {p.register && a.draft && <>
          <p className="text-sm font-medium">지금 &apos;{STATUS_LABELS[p.student.status as StudentStatus] ?? p.student.status}&apos; 상태라 재원 등록을 함께 합니다. 학생 번호와 상담 기록은 그대로 둡니다.</p>
          <AdmissionReviewTerms draft={a.draft} today={a.today} busy={a.busy} onChange={a.changeTerms} onCalculate={()=>void a.checkExistingFields(true)}/>
          {p.quote && <AdmissionReviewQuote title="계산 결과" quote={p.quote} today={a.today}/>}
        </>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.identityConfirmed} disabled={a.busy} onChange={e=>a.setIdentityConfirmed(e.target.checked)}/>원서와 동일한 학생임을 확인했습니다</label>
        <Button type="button" disabled={a.busy||!a.identityConfirmed||(p.register&&!p.quote)} onClick={()=>void a.confirmExisting()}>
          {!p.register?'기존 학생에 원서 내용 반영':!p.quote?'일할 금액을 먼저 확인해 주세요':immediate?'원서 내용 반영하고 오늘 재원 등록':`원서 내용 반영하고 ${p.quote.enrollment_date} 등록 예약`}
        </Button>
      </>}
    </>}
  </section>;
}
