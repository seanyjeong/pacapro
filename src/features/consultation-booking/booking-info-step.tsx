import { ChevronDown } from 'lucide-react';
import type { ConsultationFormData, MockTestGrades, StudentGrade } from '@/lib/types/consultation';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { admissionOptions, formatPhoneNumber, genderOptions, gradeScoreOptions, gradeSelectOptions } from './booking-constants';
import { BookingIntakePanel } from './booking-intake-panel';
import { BookingActionBar, BookingCard } from './booking-ui';

interface BookingInfoStepProps {
  branches: { id: number; name: string }[];
  error: string | null;
  formData: ConsultationFormData;
  onChange: (patch: Partial<ConsultationFormData>) => void;
  onMockGradeChange: (subject: keyof MockTestGrades, value: number | undefined) => void;
  onNext: () => void;
  referralSources: string[];
}

const fieldClass = 'h-12 w-full min-w-0 rounded-xl border border-transparent bg-muted px-4 text-base text-foreground transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10';

export function BookingInfoStep({
  branches,
  error,
  formData,
  onChange,
  onMockGradeChange,
  onNext,
  referralSources,
}: BookingInfoStepProps) {
  return (
    <div className="space-y-4">
      <BookingIntakePanel formData={formData} />

      <BookingCard title="학생 정보">
        <div className="space-y-4">
          {branches.length > 0 && (
            <SelectField
              label="지점 *"
              value={formData.branchId ? String(formData.branchId) : ''}
              options={[{ label: '지점 선택', value: '' }, ...branches.map((branch) => ({ label: branch.name, value: String(branch.id) }))]}
              onChange={(branchId) => onChange({ branchId: branchId ? Number(branchId) : undefined })}
            />
          )}
          <TextField label="이름 *" value={formData.studentName} onChange={(studentName) => onChange({ studentName })} />
          <TextField
            inputMode="numeric"
            label="연락처 *"
            value={formData.studentPhone || ''}
            onChange={(studentPhone) => onChange({ studentPhone: formatPhoneNumber(studentPhone) })}
          />
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <TextField label="학교 *" value={formData.studentSchool || ''} onChange={(studentSchool) => onChange({ studentSchool })} />
        </div>
      </BookingCard>

      <BookingCard title="성적">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
            <p className="mb-2 text-sm font-semibold text-foreground">모의고사 등급</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SelectField label="국어 *" value={formData.mockTestGrades?.korean?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('korean', parseOptionalGrade(value))} />
              <SelectField label="수학 *" value={formData.mockTestGrades?.math?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('math', parseOptionalGrade(value))} />
              <SelectField label="영어 *" value={formData.mockTestGrades?.english?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('english', parseOptionalGrade(value))} />
              <SelectField label="탐구 *" value={formData.mockTestGrades?.exploration?.toString() || ''} options={gradeScoreOptions} onChange={(value) => onMockGradeChange('exploration', parseOptionalGrade(value))} />
            </div>
          </div>
        </div>
      </BookingCard>

      <BookingCard title="추가 정보">
        <div className="space-y-4">
          <TextField label="희망 학교" value={formData.targetSchool || ''} onChange={(targetSchool) => onChange({ targetSchool })} />
          <TextField label="소개해주신 재원생" value={formData.referrerStudent || ''} onChange={(referrerStudent) => onChange({ referrerStudent })} />
          {referralSources.length > 0 && (
            <SelectField
              label="학원을 알게 된 경로"
              value={formData.referralSource || ''}
              options={[{ value: '', label: '선택' }, ...referralSources.map((source) => ({ value: source, label: source }))]}
              onChange={(referralSource) => onChange({ referralSource })}
            />
          )}
          <label className="grid gap-1.5 text-sm font-semibold text-secondary-foreground">
            문의 내용
            <Textarea
              className="min-h-28 text-base"
              value={formData.inquiryContent || ''}
              onChange={(event) => onChange({ inquiryContent: event.target.value })}
            />
          </label>
        </div>
      </BookingCard>

      <BookingActionBar error={error}>
        <Button className="w-full" size="lg" onClick={onNext}>다음: 일정 선택</Button>
      </BookingActionBar>
    </div>
  );
}

function TextField({ inputMode, label, onChange, value }: { inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-secondary-foreground">
      {label}
      <input
        className={fieldClass}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-secondary-foreground">
      {label}
      <span className="relative block min-w-0">
        <select
          className={`${fieldClass} appearance-none pr-10`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function parseOptionalGrade(value: string): number | undefined {
  if (!value) return undefined;
  return Number(value);
}
