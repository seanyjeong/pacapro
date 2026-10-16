'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { admissionsAPI, admissionError } from '@/lib/api/ilsan-admissions';
import type { AdmissionApplication, AdmissionPreview, AdmissionTerms } from '@/lib/types/ilsan-admission';

export type AdmissionDraft = Omit<AdmissionTerms, 'monthly_tuition'> & {monthly_tuition:number|''};
const koreaToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date());

/** Presentation-independent controller. Never submits approval without a fresh server quote. */
export function useIlsanAdmissions() {
  const [applications,setApplications] = useState<AdmissionApplication[]>([]);
  const [nextCursor,setNextCursor] = useState<number|null>(null);
  const [selected,setSelected] = useState<AdmissionApplication|null>(null);
  const [draft,setDraft] = useState<AdmissionDraft|null>(null);
  const [preview,setPreview] = useState<AdmissionPreview|null>(null);
  const [busy,setBusy] = useState(false), [loading,setLoading] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState('');
  const generation = useRef(0), actionLock = useRef(false), listGeneration = useRef(0);
  const mutationLock = useRef(false);
  const selectedId = useRef<number|null>(null);

  const load = useCallback(async (before?:number) => {
    const request = ++listGeneration.current;
    setLoading(true); setError('');
    try {
      const result = await admissionsAPI.list(before);
      if(request !== listGeneration.current) return;
      setApplications(previous => before ? [...previous.filter(p=>!result.applications.some(r=>r.id===p.id)),...result.applications] : result.applications);
      setNextCursor(result.next_cursor);
    } catch(cause) { if(request === listGeneration.current) setError(admissionError(cause)); }
    finally { if(request === listGeneration.current) setLoading(false); }
  },[]);
  useEffect(()=>{
    const pending=generation, lists=listGeneration;
    void load();return()=>{pending.current++;lists.current++;};
  },[load]);

  const select = useCallback((record:AdmissionApplication) => {
    if(actionLock.current) return;
    generation.current++; selectedId.current=record.id;
    setSelected(record); setPreview(null);setError('');setNotice('');
    setDraft(record.terms || {enrollment_date:record.profile.enrollment_date,monthly_tuition:'',discount_rate:0,class_days:[],time_slot:'evening'});
  },[]);
  const changeTerms = useCallback((patch:Partial<AdmissionDraft>) => {
    if(mutationLock.current) return;
    // Editing while a preview request is running invalidates its response immediately.
    generation.current++;setPreview(null);setError('');setNotice('');
    setDraft(previous => previous ? {...previous,...patch} : null);
  },[]);
  async function calculate() {
    if(!selected || !draft || actionLock.current) return;
    if(draft.monthly_tuition === '') {setError('월 학원비를 입력해 주세요. 무료 수업이면 0원을 입력해 주세요.');return;}
    const request=++generation.current;
    actionLock.current=true;setBusy(true);setError('');setPreview(null);setNotice('');
    try {
      const result=await admissionsAPI.preview(selected.id,{...draft,monthly_tuition:draft.monthly_tuition});
      if(request===generation.current) setPreview(result);
    } catch(cause){if(request===generation.current)setError(admissionError(cause));}
    finally{actionLock.current=false;setBusy(false);}
  }
  function replace(record:AdmissionApplication) {
    setApplications(rows=>rows.map(row=>row.id===record.id?record:row));
    if(selectedId.current===record.id){setSelected(record);setDraft(record.terms);setPreview(null);}
  }
  async function confirm() {
    if(!selected || !preview || actionLock.current || preview.duplicate_student_ids.length) return;
    actionLock.current=true;mutationLock.current=true;setBusy(true);setError('');
    try {
      const result=await admissionsAPI.confirm(selected.id,preview.terms,preview.preview_hash);
      generation.current++;replace(result);
      setNotice(result.status==='enrolled'?'PACA에 재원 등록했습니다.':`${result.enrollment_date}에 등록하도록 예약했습니다.`);
    } catch(cause){setPreview(null);setError(admissionError(cause));}
    finally{actionLock.current=false;mutationLock.current=false;setBusy(false);}
  }
  async function cancel() {
    if(!selected || actionLock.current || ['enrolled','cancelled'].includes(selected.status)) return;
    actionLock.current=true;mutationLock.current=true;setBusy(true);setError('');
    try {const result=await admissionsAPI.cancel(selected.id,selected.revision);generation.current++;replace(result);setNotice('등록 예약을 취소했습니다. 학생과 청구서는 생성되지 않습니다.');}
    catch(cause){setError(admissionError(cause));}
    finally{actionLock.current=false;mutationLock.current=false;setBusy(false);}
  }
  async function refresh() {
    if(actionLock.current) return;
    generation.current++;selectedId.current=null;setSelected(null);setDraft(null);setPreview(null);setNotice('');
    await load();
  }
  const editable=!!selected && ['submitted','scheduled','review'].includes(selected.status);
  return {applications,nextCursor,selected,draft,preview,busy,loading,error,notice,editable,
    canConfirm:editable && !!preview && !busy && !preview.duplicate_student_ids.length,
    today:koreaToday(),select,changeTerms,calculate,confirm,cancel,refresh,
    loadMore:()=>nextCursor && !loading ? load(nextCursor) : Promise.resolve()};
}
