import type { ConsultationFormData, MockTestGrades, StudentGrade } from '@/lib/types/consultation';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { admissionOptions, formatPhoneNumber, genderOptions, gradeScoreOptions, gradeSelectOptions } from './booking-constants';

interface BookingInfoStepProps {
  error: string | null;
  formData: ConsultationFormData;
  onChange: (patch: Partial<ConsultationFormData>) => void;
  onMockGradeChange: (subject: keyof MockTestGrades, value: number | undefined) => void;
  onNext: () => void;
  referralSources: string[];
}

export function BookingInfoStep({
  error,
  formData,
  onChange,
  onMockGradeChange,
  onNext,
  referralSources,
}: BookingInfoStepProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">정보 입력</h2>
      </div>
      <div className="space-y-5 p-4">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="이름 *" value={formData.studentName} onChange={(studentName) => onChange({ studentName })} />
          <TextField
            inputMode="numeric"
            label="연락처 *"
            value={formData.studentPhone || ''}
            onChange={(studentPhone) => onChange({ studentPhone: formatPhoneNumber(studentPhone) })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="학년 *"
            value={formData.studentGrade || ''}
            options={gradeSelectOptions}
            onChange={(studentGrade) => onChange({ studentGrade: studentGrade ? (studentGrade as StudentGrade) : undefined })}
          />
          <SelectField
            label="성별 *"
            value={formData.gender || ''}
            options={genderOptions}
            onChange={(gender) => onChange({ gender: gender ? (gender as 'male' | 'female') : undefined })}
          />
          <TextField label="학교 *" value={formData.studentSchool || ''} onChange={(studentSchool) => onChange({ studentSchool })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="내신 평균등급 *"
            value={formData.schoolGradeAvg?.toString() || ''}
            options={gradeScoreOptions}
            onChange={(value) => onChange({ schoolGradeAvg: parseOptionalGrade(value) })}
          />
          <SelectField
            label="입시 유형 *"
            value={formData.admissionType || ''}
            options={admissionOptions}
            onChange={(admissionType) => onChange({ admissionType })}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">모의고사 등급</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SelectField label="국어 *" value={formData.mockTestGrades?.korean?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('korean', parseOptionalGrade(value))} />
            <SelectField label="수학 *" value={formData.mockTestGrades?.math?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('math', parseOptionalGrade(value))} />
            <SelectField label="영어 *" value={formData.mockTestGrades?.english?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('english', parseOptionalGrade(value))} />
            <SelectField label="탐구 *" value={formData.mockTestGrades?.exploration?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('exploration', parseOptionalGrade(value))} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="희망 학교" value={formData.targetSchool || ''} onChange={(targetSchool) => onChange({ targetSchool })} />
          <TextField label="소개해주신 재원생" value={formData.referrerStudent || ''} onChange={(referrerStudent) => onChange({ referrerStudent })} />
        </div>

        {referralSources.length > 0 && (
          <SelectField
            label="학원을 알게 된 경로"
            value={formData.referralSource || ''}
            options={[{ value: '', label: '선택' }, ...referralSources.map((source) => ({ value: source, label: source }))]}
            onChange={(referralSource) => onChange({ referralSource })}
          />
        )}

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          문의 내용
          <Textarea
            className="min-h-24 border-slate-300 text-sm"
            value={formData.inquiryContent || ''}
            onChange={(event) => onChange({ inquiryContent: event.target.value })}
          />
        </label>

        <Button className="w-full" onClick={onNext}>다음: 일정 선택</Button>
      </div>
    </section>
  );
}

function TextField({ inputMode, label, onChange, value }: { inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      {label}
      <select
        className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function parseOptionalGrade(value: string): number | undefined {
  if (!value) return undefined;
  return Number(value);
}
