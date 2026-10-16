import type { AdmissionProfile } from '@/lib/types/ilsan-admission';
import { ADMISSION_FIELD_CLASS, ADMISSION_GRADES } from '@/constants/ilsan-admission';
import { cn } from '@/lib/utils/cn';
import { AdmissionInput } from './admission-input';
import { AdmissionSection } from './admission-section';
interface Props {value:AdmissionProfile;onChange:(field:keyof AdmissionProfile,value:string|boolean)=>void}
const SELECT_CLASS=cn(ADMISSION_FIELD_CLASS,'h-12');
const SELECT_LABEL_CLASS='block min-w-0 space-y-1.5 text-sm font-medium text-foreground/80';
export function AdmissionProfileFields({value,onChange}:Props) {
  return <>
    <AdmissionSection step={1} title="학생 정보">
      <div className="grid gap-5 sm:grid-cols-2">
        <AdmissionInput id="admission-name" label="학생 이름" required maxLength={50} autoComplete="name" value={value.name} onChange={e=>onChange('name',e.target.value)}/>
        <AdmissionInput id="admission-school" label="학교" required maxLength={100} value={value.school} onChange={e=>onChange('school',e.target.value)} help="학교에 다니지 않는 경우 검정고시 등 현재 상태를 적어 주세요."/>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-5">
          <label className={SELECT_LABEL_CLASS}><span className="block">학년<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></span>
            <select aria-label="학년" required className={SELECT_CLASS} value={value.grade} onChange={e=>onChange('grade',e.target.value)}>
              <option value="">학년 선택</option>{ADMISSION_GRADES.map(grade=><option key={grade}>{grade}</option>)}
            </select>
          </label>
          <label className={SELECT_LABEL_CLASS}><span className="block">성별<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></span>
            <select aria-label="성별" required className={SELECT_CLASS} value={value.gender} onChange={e=>onChange('gender',e.target.value)}>
              <option value="">성별 선택</option><option value="male">남학생</option><option value="female">여학생</option>
            </select>
          </label>
        </div>
        <AdmissionInput id="admission-birth" label="생년월일 앞 6자리" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="080215" value={value.birth_six} onChange={e=>onChange('birth_six',e.target.value)} help="주민등록번호 뒷자리는 입력하지 않습니다."/>
        <AdmissionInput id="admission-phone" label="학생 전화번호" required type="tel" autoComplete="tel" maxLength={20} placeholder="010-0000-0000" value={value.phone} onChange={e=>onChange('phone',e.target.value)}/>
      </div>
    </AdmissionSection>
    <AdmissionSection step={2} title="보호자 정보" description="두 분 정보를 각각 입력할 수 있습니다. 연락 가능한 보호자 전화번호는 한 분 이상 필요합니다.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
          <AdmissionInput id="admission-father-name" label="아버님 성함" maxLength={50} value={value.father_name} onChange={e=>onChange('father_name',e.target.value)}/>
          <AdmissionInput id="admission-father-phone" label="아버님 전화번호" type="tel" maxLength={20} placeholder="010-0000-0000" value={value.father_phone} onChange={e=>onChange('father_phone',e.target.value)}/>
        </div>
        <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
          <AdmissionInput id="admission-mother-name" label="어머님 성함" maxLength={50} value={value.mother_name} onChange={e=>onChange('mother_name',e.target.value)}/>
          <AdmissionInput id="admission-mother-phone" label="어머님 전화번호" type="tel" maxLength={20} placeholder="010-0000-0000" value={value.mother_phone} onChange={e=>onChange('mother_phone',e.target.value)}/>
        </div>
      </div>
      <label className={SELECT_LABEL_CLASS}><span className="block">학원 안내를 받을 보호자</span>
        <select aria-label="학원 안내를 받을 보호자" className={SELECT_CLASS} value={value.primary_parent} onChange={e=>onChange('primary_parent',e.target.value)}>
          <option value="mother">어머님</option><option value="father">아버님</option>
        </select>
      </label>
    </AdmissionSection>
  </>;
}
