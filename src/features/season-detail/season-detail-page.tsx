'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefundModal } from '@/components/refund/refund-modal';
import { SeasonConfirmDialog } from '@/features/seasons/season-confirm-dialog';
import type { StudentSeason } from '@/lib/types/season';
import { EnrolledStudentsSection } from './enrolled-students-section';
import { SeasonDetailError } from './season-detail-error';
import { SeasonDetailHeader } from './season-detail-header';
import { SeasonDetailLoading } from './season-detail-loading';
import { SeasonInfoPanel } from './season-info-panel';
import { SeasonSummaryStrip } from './season-summary-strip';
import { SeasonTimeSlotsPanel } from './season-time-slots-panel';
import { useSeasonDetailState } from './use-season-detail-state';
import { parseSeasonId } from './season-detail-utils';

export function SeasonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = parseSeasonId(params.id);
  const state = useSeasonDetailState(seasonId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<StudentSeason | null>(null);

  if (state.loading) {
    return <SeasonDetailLoading />;
  }

  if (state.error || !state.season || !seasonId) {
    return <SeasonDetailError message={state.error} onBack={() => router.push('/seasons')} onRetry={state.reload} />;
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmingDelete(true);
    const deleted = await state.deleteSeason();
    setConfirmingDelete(false);
    if (deleted) router.push('/seasons');
  };

  const handleCancelEnrollment = async (enrollmentId: number) => {
    const enrollment = state.enrolledStudents.find((student) => student.id === enrollmentId);
    if (!enrollment) return;
    if (enrollment.payment_status !== 'paid') {
      setCancelTarget(enrollment);
      return;
    }
    await state.cancelEnrollment(enrollment);
  };

  const handleConfirmCancelEnrollment = async () => {
    if (!cancelTarget) return;
    await state.cancelEnrollment(cancelTarget);
    setCancelTarget(null);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <SeasonDetailHeader
        addStudentHref={`/seasons/${seasonId}/enroll`}
        season={state.season}
        onBack={() => router.push('/seasons')}
        onDelete={handleDelete}
        onEdit={() => router.push(`/seasons/${seasonId}/edit`)}
      />

      <SeasonSummaryStrip enrolledCount={state.enrolledStudents.length} season={state.season} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <SeasonInfoPanel season={state.season} />
        <SeasonTimeSlotsPanel season={state.season} />
      </div>

      <EnrolledStudentsSection
        cancellingId={state.cancellingId}
        enrolledStudents={state.enrolledStudents}
        season={state.season}
        updatingTimeSlotId={state.updatingTimeSlotId}
        onAddStudent={() => router.push(`/seasons/${seasonId}/enroll`)}
        onCancelEnrollment={handleCancelEnrollment}
        onOpenRefund={state.openRefundModal}
        onTimeSlotChange={state.changeTimeSlot}
      />

      <RefundModal
        academy={state.refundPreview?.academy ?? {}}
        cancellationDate={state.refundPreview?.cancellation_date ?? state.cancellationDate}
        enrollment={state.refundPreview?.enrollment ?? null}
        isOpen={state.refundModalOpen}
        loading={state.refundLoading}
        refund={state.refundPreview?.refund ?? null}
        onClose={state.closeRefundModal}
        onConfirm={state.confirmRefund}
      />

      {deleteDialogOpen ? (
        <SeasonConfirmDialog
          busy={confirmingDelete}
          confirmLabel="삭제"
          description="이 시즌을 삭제할까요?"
          detail={state.season.season_name}
          title="시즌 삭제"
          warning="등록된 학생이 있으면 삭제할 수 없습니다."
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {cancelTarget ? (
        <SeasonConfirmDialog
          busy={state.cancellingId === cancelTarget.id}
          confirmLabel="등록 취소"
          description={`${cancelTarget.student_name} 학생의 시즌 등록을 취소할까요?`}
          detail={state.season.season_name}
          title="시즌 등록 취소"
          warning="취소하면 등록 학생 목록에서 제외됩니다."
          onCancel={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancelEnrollment}
        />
      ) : null}
    </div>
  );
}
