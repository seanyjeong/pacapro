'use client';
import { Button } from '@/components/ui/button';
import { ADMISSION_FIELD_CLASS } from '@/constants/ilsan-admission';
import type { useIlsanAdmissions } from '@/hooks/use-ilsan-admissions';

export function AdmissionReviewExisting({admissions:a}:{admissions:ReturnType<typeof useIlsanAdmissions>}) {
  if(!a.editable || !a.existingStudents.length)return null;
  return <section className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-5">
    <h3 className="font-semibold">같은 이름의 기존 학생이 있습니다</h3>
    <label className="block text-sm">처리 방법
      <select aria-label="처리 방법" className={ADMISSION_FIELD_CLASS} value={a.mode} disabled={a.busy} onChange={e=>a.changeMode(e.target.value as 'new'|'existing')}>
        <option value="existing">기존 학생의 빈 정보만 채우기</option>
        <option value="new">다른 사람임을 확인하고 신규 등록</option>
      </select>
    </label>
    {a.mode==='existing' && <>
      <p className="text-sm text-muted-foreground">기존 값과 재원 상태·등록일·학원비·수업 배정은 그대로 유지합니다. 동명이인이면 전화번호·학교를 확인해 선택해 주세요.</p>
      <label className="block text-sm">기존 학생
        <select aria-label="기존 학생" className={ADMISSION_FIELD_CLASS} value={a.existingStudentId ?? ''} disabled={a.busy} onChange={e=>a.chooseExisting(e.target.value?Number(e.target.value):null)}>
          <option value="">학생을 선택해 주세요</option>
          {a.existingStudents.map(s=><option key={s.id} value={s.id}>{s.name} · {s.student_number||`학생 ${s.id}`} · {s.phone||'전화 미입력'} · {s.school||'학교 미입력'} {s.grade}</option>)}
        </select>
      </label>
      <Button type="button" disabled={a.busy||!a.existingStudentId} onClick={()=>void a.checkExistingFields()}>추가할 정보 확인</Button>
      {a.existingPreview && <>
        <ul className="space-y-2 text-sm" aria-label="정보 보완 미리보기">
          {a.existingPreview.fields.map(f=><li key={f.field}><b>{f.label}</b>: {f.action==='fill'?`미입력 → ${f.incoming} (추가)`:`${f.current||'미입력'} (유지)`}</li>)}
        </ul>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.identityConfirmed} disabled={a.busy} onChange={e=>a.setIdentityConfirmed(e.target.checked)}/>원서와 동일한 학생임을 확인했습니다</label>
        <Button type="button" disabled={a.busy||!a.identityConfirmed} onClick={()=>void a.confirmExisting()}>기존 학생에 빈 정보만 반영</Button>
      </>}
    </>}
  </section>;
}
