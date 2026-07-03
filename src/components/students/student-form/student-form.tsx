'use client';

/**
 * Student Form Component — thin orchestrator (ADR-018)
 * 학생 등록/수정 폼 컴포넌트 (공용) - 입시생/성인 구분 지원
 *
 * Props 시그니처 무변경 (caller 호환 — students/new/page.tsx, students/[id]/edit/page.tsx)
 * State/handler → _hooks/useStudentForm.ts
 * UI 섹션 → _components/<XxxSection>.tsx
 */

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentRestModal } from '../student-rest-modal';
import type { Student, StudentFormData } from '@/lib/types/student';
import { useStudentForm } from './_hooks/useStudentForm';
import { TrialSection } from './_components/TrialSection';
import { BasicInfoSection } from './_components/BasicInfoSection';
import { StudentTypeSection } from './_components/StudentTypeSection';
import { ClassInfoSection } from './_components/ClassInfoSection';
import { SeasonSection } from './_components/SeasonSection';
import { TuitionSection } from './_components/TuitionSection';
import { AdditionalInfoSection } from './_components/AdditionalInfoSection';
import { SubmitConfirmDialog } from './_components/SubmitConfirmDialog';
import { StudentPhotoField } from './_components/StudentPhotoField';

interface StudentFormProps {
  mode: 'create' | 'edit';
  initialData?: Student;
  initialIsTrial?: boolean;
  onSubmit: (data: StudentFormData, pendingPhotoFile?: File | null) => Promise<void>;
  onCancel: () => void;
  onPhotoChanged?: () => void;
  onRestSuccess?: () => void;
}

export function StudentForm({
  mode,
  initialData,
  initialIsTrial = false,
  onSubmit,
  onCancel,
  onPhotoChanged,
  onRestSuccess,
}: StudentFormProps) {
  const hook = useStudentForm({ mode, initialData, initialIsTrial, onSubmit });

  return (
    <form onSubmit={hook.handleSubmit} className="space-y-5">
      <StudentPhotoField
        mode={mode}
        pendingPhotoFile={hook.pendingPhotoFile}
        student={initialData}
        onPendingPhotoFileChange={hook.setPendingPhotoFile}
        onPhotoChanged={onPhotoChanged}
      />

      {/* 체험생 섹션 (create: 등록 옵션, edit: 일정 수정) */}
      <TrialSection
        mode={mode}
        isTrial={hook.isTrial}
        setIsTrial={hook.setIsTrial}
        trialDates={hook.trialDates}
        timeSlotLabels={hook.timeSlotLabels}
        addTrialDate={hook.addTrialDate}
        removeTrialDate={hook.removeTrialDate}
        updateTrialDate={hook.updateTrialDate}
      />

      {/* 기본 정보 */}
      <BasicInfoSection
        mode={mode}
        formData={hook.formData}
        errors={hook.errors}
        handleChange={hook.handleChange}
        formatPhoneNumber={hook.formatPhoneNumber}
      />

      {/* 학생 유형 */}
      <StudentTypeSection
        formData={hook.formData}
        errors={hook.errors}
        admissionOptions={hook.admissionOptions}
        handleChange={hook.handleChange}
      />

      {/* 수업 정보 */}
      <ClassInfoSection
        mode={mode}
        formData={hook.formData}
        initialData={initialData}
        classDaysChanged={hook.classDaysChanged}
        effectiveFrom={hook.effectiveFrom}
        setEffectiveFrom={hook.setEffectiveFrom}
        effectiveMonthOptions={hook.effectiveMonthOptions}
        handleChange={hook.handleChange}
        handleClassDayToggle={hook.handleClassDayToggle}
        handleDayTimeSlotChange={hook.handleDayTimeSlotChange}
      />

      {/* 시즌 등록 (고3/N수, 신규, 체험생 제외) */}
      <SeasonSection
        mode={mode}
        isSeasonTarget={hook.isSeasonTarget}
        isTrial={hook.isTrial}
        seasonsLoading={hook.seasonsLoading}
        availableSeasons={hook.availableSeasons}
        enrollInSeason={hook.enrollInSeason}
        selectedSeasonId={hook.selectedSeasonId}
        setEnrollInSeason={hook.setEnrollInSeason}
        setSelectedSeasonId={hook.setSelectedSeasonId}
      />

      {/* 학원비 (체험생 제외) */}
      <TuitionSection
        isTrial={hook.isTrial}
        formData={hook.formData}
        errors={hook.errors}
        finalTuition={hook.finalTuition}
        academySettings={hook.academySettings}
        handleChange={hook.handleChange}
        formatCurrency={hook.formatCurrency}
      />

      {/* 추가 정보 + 상태 + 휴식 */}
      <AdditionalInfoSection
        mode={mode}
        formData={hook.formData}
        initialData={initialData}
        isIndefiniteRest={hook.isIndefiniteRest}
        setIsIndefiniteRest={hook.setIsIndefiniteRest}
        handleChange={hook.handleChange}
        onOpenRestModal={() => hook.setRestModalOpen(true)}
      />

      {/* 에러 메시지 */}
      {hook.errors.submit && (
        <section
          className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
          data-testid="student-form-submit-error"
          role="alert"
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">저장 실패</h2>
              <p className="text-sm">{hook.errors.submit}</p>
            </div>
          </div>
        </section>
      )}

      {/* 버튼 */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={hook.submitting}>
          취소
        </Button>
        <Button type="submit" disabled={hook.submitting}>
          {hook.submitting ? '저장 중...' : mode === 'create' ? '등록' : '수정'}
        </Button>
      </div>

      {/* 휴원 처리 모달 */}
      {initialData && (
        <StudentRestModal
          open={hook.restModalOpen}
          onClose={() => hook.setRestModalOpen(false)}
          student={{
            id: initialData.id,
            name: initialData.name,
            monthly_tuition: initialData.monthly_tuition,
            weekly_count: initialData.weekly_count,
          }}
          onSuccess={() => {
            hook.setRestModalOpen(false);
            if (onRestSuccess) {
              onRestSuccess();
            } else {
              window.location.reload();
            }
          }}
        />
      )}

      <SubmitConfirmDialog
        confirmState={hook.confirmState}
        open={hook.confirmState !== null}
        submitting={hook.submitting}
        onCancel={() => hook.setConfirmState(null)}
        onConfirm={hook.confirmPendingSubmit}
      />
    </form>
  );
}
