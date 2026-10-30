import type { AdmissionProfile } from '@/lib/types/ilsan-admission';
export const ILSAN_ACADEMY_ID = 2;
export const ADMISSION_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3', 'N수'];
export const ADMISSION_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const ADMISSION_STATUSES = { submitted: '접수', scheduled: '등록 예약', enrolled: '등록 완료', cancelled: '취소', review: '확인 필요' };
export const ADMISSION_FIELD_CLASS = 'w-full rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export const EMPTY_ADMISSION: AdmissionProfile = {name:'',school:'',grade:'',gender:'',birth_six:'',phone:'',father_name:'',mother_name:'',father_phone:'',mother_phone:'',primary_parent:'mother',enrollment_date:'',consent:false};
