import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Season, StudentSeason, TimeSlot } from '@/lib/types/season';
import { formatDate } from '@/lib/utils/format';
import {
  cancelEnrollmentWithRefund,
  fetchEnrolledStudents,
  fetchRefundPreview,
  fetchSeasonDetail,
  removeEnrollment,
  removeSeason,
  updateEnrollmentTimeSlots,
} from './season-detail-api';
import type { SeasonRefundPreview } from './season-detail-types';
import {
  ENROLLED_STUDENTS_LOAD_ERROR,
  ENROLLMENT_CANCEL_ERROR,
  getEnrollmentTimeSlots,
  REFUND_CONFIRM_ERROR,
  REFUND_PREVIEW_ERROR,
  SEASON_DELETE_ERROR,
  SEASON_DETAIL_LOAD_ERROR,
  TIME_SLOT_UPDATE_ERROR,
  toggleTimeSlot,
} from './season-detail-utils';

export function useSeasonDetailState(seasonId: number | null) {
  const [season, setSeason] = useState<Season | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [updatingTimeSlotId, setUpdatingTimeSlotId] = useState<number | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<StudentSeason | null>(null);
  const [refundPreview, setRefundPreview] = useState<SeasonRefundPreview | null>(null);
  const [cancellationDate] = useState(() => formatDate(new Date()));

  const loadStudents = useCallback(async () => {
    if (!seasonId) return;
    const students = await fetchEnrolledStudents(seasonId);
    setEnrolledStudents(students);
  }, [seasonId]);

  const reload = useCallback(async () => {
    if (!seasonId) {
      setError(SEASON_DETAIL_LOAD_ERROR);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchSeasonDetail(seasonId);
      setSeason(response.season);
      setEnrolledStudents(response.enrolled_students ?? []);
      try {
        await loadStudents();
      } catch {
        toast.error(ENROLLED_STUDENTS_LOAD_ERROR);
      }
    } catch {
      setError(SEASON_DETAIL_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [loadStudents, seasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const deleteSeason = async () => {
    if (!seasonId) return false;
    try {
      await removeSeason(seasonId);
      toast.success('시즌이 삭제되었습니다.');
      return true;
    } catch {
      toast.error(SEASON_DELETE_ERROR);
      return false;
    }
  };

  const openRefundModal = async (enrollment: StudentSeason) => {
    setSelectedEnrollment(enrollment);
    setRefundLoading(true);
    try {
      const preview = await fetchRefundPreview(enrollment.id, cancellationDate);
      setRefundPreview(preview);
      setRefundModalOpen(true);
    } catch {
      setSelectedEnrollment(null);
      toast.error(REFUND_PREVIEW_ERROR);
    } finally {
      setRefundLoading(false);
    }
  };

  const closeRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedEnrollment(null);
    setRefundPreview(null);
  };

  const confirmRefund = async (includeVat: boolean, finalAmount: number) => {
    if (!selectedEnrollment) return;
    try {
      await cancelEnrollmentWithRefund(selectedEnrollment.id, cancellationDate, includeVat, finalAmount);
      toast.success('시즌 등록이 취소되었습니다.');
      closeRefundModal();
      await loadStudents();
    } catch {
      toast.error(REFUND_CONFIRM_ERROR);
    }
  };

  const cancelEnrollment = async (enrollment: StudentSeason) => {
    if (!seasonId) return;
    if (enrollment.payment_status === 'paid') {
      await openRefundModal(enrollment);
      return;
    }

    try {
      setCancellingId(enrollment.id);
      await removeEnrollment(seasonId, enrollment.student_id);
      toast.success('시즌 등록이 취소되었습니다.');
      await loadStudents();
    } catch {
      toast.error(ENROLLMENT_CANCEL_ERROR);
    } finally {
      setCancellingId(null);
    }
  };

  const changeTimeSlot = async (enrollment: StudentSeason, slot: TimeSlot) => {
    const currentSlots = getEnrollmentTimeSlots(season, enrollment);
    const nextSlots = toggleTimeSlot(currentSlots, slot);

    if (nextSlots.length === 0) {
      toast.error('최소 1개의 시간대를 선택해야 합니다.');
      return;
    }

    try {
      setUpdatingTimeSlotId(enrollment.id);
      await updateEnrollmentTimeSlots(enrollment.id, nextSlots);
      setEnrolledStudents((students) =>
        students.map((student) => (student.id === enrollment.id ? { ...student, time_slots: nextSlots } : student))
      );
      toast.success('시간대가 변경되었습니다.');
    } catch {
      toast.error(TIME_SLOT_UPDATE_ERROR);
    } finally {
      setUpdatingTimeSlotId(null);
    }
  };

  return {
    cancellationDate,
    cancellingId,
    changeTimeSlot,
    cancelEnrollment,
    closeRefundModal,
    confirmRefund,
    deleteSeason,
    enrolledStudents,
    error,
    loading,
    openRefundModal,
    refundLoading,
    refundModalOpen,
    refundPreview,
    reload,
    season,
    selectedEnrollment,
    updatingTimeSlotId,
  };
}
