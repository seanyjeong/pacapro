'use client';

// consultations/[id]/conduct/page.tsx — thin orchestrator (ADR-018)
// 원본 1,651줄 → 9 서브모듈 분리 (Phase 4 #4)

import { use } from 'react';
import { AlertCircle } from 'lucide-react';
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
      <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <div className="h-28 rounded-md border border-border bg-card" />
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.8fr]">
            <div className="space-y-5">
              <div className="h-56 rounded-md border border-border bg-card" />
              <div className="h-64 rounded-md border border-border bg-card" />
            </div>
            <div className="h-[520px] rounded-md border border-border bg-card" />
          </div>
        </div>
      </main>
    );
  }

  if (c.loadError || !c.consultation) {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center">
          <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base font-semibold">상담 정보를 불러오지 못했습니다</h1>
                <p className="mt-1 text-sm">{c.loadError || '잠시 후 다시 시도해주세요.'}</p>
                <Link href={c.backUrl}>
                  <Button variant="outline" className="mt-4 bg-background/80">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {c.backLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 pb-28">
      <ConductHeader
        consultation={c.consultation}
        backLabel={c.backLabel}
        progressPercent={c.progressPercent}
        saving={c.saving}
        onBack={handleBack}
        onSave={handleSave}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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
    </main>
  );
}
