'use client';

/**
 * 태블릿 상담 진행 페이지 (thin orchestrator, ADR-018)
 * - PC 기능과 동일, 태블릿에 최적화된 레이아웃
 * - state/handler → useTabletConduct hook 위임
 * - UI → _components/ 위임
 */

import { use } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTabletConduct } from './_hooks/useTabletConduct';
import { TabletConductHeader } from './_components/TabletConductHeader';
import { TabletLearningView } from './_components/TabletLearningView';
import { TabletNewInquiryView } from './_components/TabletNewInquiryView';
import { TabletBottomActionBar } from './_components/TabletBottomActionBar';
import { TabletTrialModal } from './_components/TabletTrialModal';
import { TabletPendingModal } from './_components/TabletPendingModal';
import { TabletStudentEditModal } from './_components/TabletStudentEditModal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TabletConductPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const conduct = useTabletConduct(resolvedParams.id);

  const {
    router,
    backUrl,
    backLabel,
    consultation,
    loading,
    saving,
    checklist,
    consultationMemo,
    setConsultationMemo,
    expandedCategories,
    groupedChecklist,
    progressPercent,
    trialModalOpen,
    setTrialModalOpen,
    trialDates,
    setTrialDates,
    convertingToTrial,
    pendingModalOpen,
    setPendingModalOpen,
    pendingMemo,
    setPendingMemo,
    convertingToPending,
    studentEditModalOpen,
    setStudentEditModalOpen,
    studentEditForm,
    setStudentEditForm,
    savingStudent,
    linkedStudent,
    peakRecords,
    peakLoading,
    learningForm,
    setLearningForm,
    expandedSections,
    loadPeakRecords,
    toggleCheck,
    updateInputValue,
    toggleCategory,
    toggleSection,
    handleSave,
    addTrialDate,
    removeTrialDate,
    handleConvertToTrial,
    openStudentEditModal,
    handleSaveStudentInfo,
    handleConvertToPending,
  } = conduct;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">상담 정보를 찾을 수 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(backUrl)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <TabletConductHeader
        consultation={consultation}
        progressPercent={progressPercent}
        backLabel={backLabel}
        onBack={() => router.push(backUrl)}
      />

      {consultation.consultation_type === 'learning' ? (
        <TabletLearningView
          learningForm={learningForm}
          setLearningForm={setLearningForm}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          peakRecords={peakRecords}
          peakLoading={peakLoading}
          linkedStudentId={consultation.linked_student_id}
          loadPeakRecords={loadPeakRecords}
        />
      ) : (
        <TabletNewInquiryView
          consultation={consultation}
          checklist={checklist}
          consultationMemo={consultationMemo}
          setConsultationMemo={setConsultationMemo}
          groupedChecklist={groupedChecklist}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          toggleCheck={toggleCheck}
          updateInputValue={updateInputValue}
          onOpenStudentEdit={openStudentEditModal}
        />
      )}

      <TabletBottomActionBar
        consultation={consultation}
        checklist={checklist}
        linkedStudent={linkedStudent}
        saving={saving}
        backUrl={backUrl}
        onBack={() => router.push(backUrl)}
        onSave={handleSave}
        onOpenTrial={() => setTrialModalOpen(true)}
        onOpenPending={() => setPendingModalOpen(true)}
      />

      <TabletTrialModal
        open={trialModalOpen}
        onOpenChange={setTrialModalOpen}
        studentName={consultation.student_name || ''}
        trialDates={trialDates}
        setTrialDates={setTrialDates}
        converting={convertingToTrial}
        onAddDate={addTrialDate}
        onRemoveDate={removeTrialDate}
        onConfirm={handleConvertToTrial}
      />

      <TabletPendingModal
        open={pendingModalOpen}
        onOpenChange={setPendingModalOpen}
        studentName={consultation.student_name || ''}
        pendingMemo={pendingMemo}
        setPendingMemo={setPendingMemo}
        converting={convertingToPending}
        onConfirm={handleConvertToPending}
      />

      <TabletStudentEditModal
        open={studentEditModalOpen}
        onOpenChange={setStudentEditModalOpen}
        studentEditForm={studentEditForm}
        setStudentEditForm={setStudentEditForm}
        saving={savingStudent}
        onConfirm={handleSaveStudentInfo}
      />
    </div>
  );
}
