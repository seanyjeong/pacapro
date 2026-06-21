'use client';

// consultations/[id]/conduct/page.tsx — thin orchestrator (ADR-018)
// 원본 1,651줄 → 9 서브모듈 분리 (Phase 4 #4)

import { use } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useConsultationDraftAutosave } from '@/hooks/useConsultationDraftAutosave';

import { useConduct } from './_hooks/useConduct';
import { ConductHeader } from './_components/ConductHeader';
import { LearningView } from './_components/LearningView';
import { NewInquiryView } from './_components/NewInquiryView';
import { BottomActionBar } from './_components/BottomActionBar';
import { MemoModal } from './_components/MemoModal';
import { TrialModal } from './_components/TrialModal';
import { PendingModal } from './_components/PendingModal';
import { StudentEditModal } from './_components/StudentEditModal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConductPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const c = useConduct(resolvedParams.id);
  const draftAutosave = useConsultationDraftAutosave({
    consultationId: c.consultation?.id,
    enabled: !c.loading && !!c.consultation && c.consultation.consultation_type !== 'learning',
    checklist: c.checklist,
    consultationMemo: c.consultationMemo,
  });

  const handleBack = async () => {
    const saved = await draftAutosave.saveDraftNow();
    if (saved) {
      router.push(c.backUrl);
    }
  };

  const handleSave = async () => {
    const saved = await draftAutosave.saveDraftNow();
    if (saved) {
      await c.handleSave();
    }
  };

  if (c.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!c.consultation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground">상담 정보를 찾을 수 없습니다.</p>
        <Link href={c.backUrl}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {c.backLabel}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <ConductHeader
        consultation={c.consultation}
        backLabel={c.backLabel}
        progressPercent={c.progressPercent}
        saving={c.saving}
        onBack={handleBack}
        onSave={handleSave}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {c.consultation.consultation_type === 'learning' ? (
          <LearningView
            learningForm={c.learningForm}
            setLearningForm={c.setLearningForm}
            expandedSections={c.expandedSections}
            toggleSection={c.toggleSection}
            previousConsultations={c.previousConsultations}
            peakRecords={c.peakRecords}
            peakLoading={c.peakLoading}
            linkedStudentId={c.consultation.linked_student_id}
            loadPeakRecords={c.loadPeakRecords}
            setMemoModal={c.setMemoModal}
          />
        ) : (
          <NewInquiryView
            consultation={c.consultation}
            checklist={c.checklist}
            consultationMemo={c.consultationMemo}
            setConsultationMemo={c.setConsultationMemo}
            groupedChecklist={c.groupedChecklist}
            expandedCategories={c.expandedCategories}
            toggleCategory={c.toggleCategory}
            toggleCheck={c.toggleCheck}
            updateInputValue={c.updateInputValue}
            onOpenStudentEdit={c.openStudentEditModal}
          />
        )}
      </div>

      <MemoModal
        memoModal={c.memoModal}
        onOpenChange={(open) => c.setMemoModal(prev => ({ ...prev, open }))}
      />

      <BottomActionBar
        consultation={c.consultation}
        linkedStudent={c.linkedStudent}
        checklist={c.checklist}
        saving={c.saving}
        onBack={handleBack}
        onSave={handleSave}
        onOpenPending={() => c.setPendingModalOpen(true)}
        onOpenTrial={() => c.setTrialModalOpen(true)}
      />

      <TrialModal
        open={c.trialModalOpen}
        onOpenChange={c.setTrialModalOpen}
        studentName={c.consultation?.student_name}
        trialDates={c.trialDates}
        setTrialDates={c.setTrialDates}
        convertingToTrial={c.convertingToTrial}
        onAddDate={c.addTrialDate}
        onRemoveDate={c.removeTrialDate}
        onConvert={c.handleConvertToTrial}
      />

      <PendingModal
        open={c.pendingModalOpen}
        onOpenChange={c.setPendingModalOpen}
        studentName={c.consultation?.student_name}
        pendingMemo={c.pendingMemo}
        setPendingMemo={c.setPendingMemo}
        convertingToPending={c.convertingToPending}
        onConvert={c.handleConvertToPending}
      />

      <StudentEditModal
        open={c.studentEditModalOpen}
        onOpenChange={c.setStudentEditModalOpen}
        studentEditForm={c.studentEditForm}
        setStudentEditForm={c.setStudentEditForm}
        savingStudent={c.savingStudent}
        onSave={c.handleSaveStudentInfo}
      />
    </div>
  );
}
