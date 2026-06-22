'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Loader2, AlertCircle } from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import axios from 'axios';
import type { Season, StudentSeason, ProRatedPreview, RefundPreviewResponse } from '@/lib/types/season';
import { RefundModal } from '@/components/refund/refund-modal';
import { StudentSeasonCancelDialog } from './student-season-cancel-dialog';
import { StudentSeasonHistoryCard } from './student-season-history-card';
import { StudentSeasonEditModal, StudentSeasonEnrollModal } from './student-season-modals';

interface StudentSeasonsProps {
  studentId: number;
  studentType: 'exam' | 'adult';
}

export function StudentSeasonsComponent({ studentId, studentType }: StudentSeasonsProps) {
  const [enrollments, setEnrollments] = useState<StudentSeason[]>([]);
  const [activeSeasons, setActiveSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [isContinuous, setIsContinuous] = useState(false);
  const [registrationDate, setRegistrationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState<ProRatedPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<StudentSeason | null>(null);
  const [editData, setEditData] = useState({
    registration_date: '',
    season_fee: 0,
    discount_amount: 0,
    discount_reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPreview, setRefundPreview] = useState<RefundPreviewResponse | null>(null);
  const [selectedEnrollmentForRefund, setSelectedEnrollmentForRefund] = useState<StudentSeason | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<StudentSeason | null>(null);
  const [canceling, setCanceling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [enrollmentsData, seasonsData] = await Promise.all([
        seasonsApi.getStudentSeasonHistory(studentId),
        seasonsApi.getActiveSeasons(),
      ]);

      setEnrollments(enrollmentsData);
      setActiveSeasons(seasonsData);
    } catch (err) {
      console.warn('시즌 정보를 불러오지 못했습니다.', err);
      setError('시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const loadPreview = useCallback(async () => {
    if (!selectedSeasonId) return;

    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const previousEnrollment = enrollments.find(e =>
        e.status === 'completed' || e.status === 'active'
      );
      const previewData = await seasonsApi.getProRatedPreview(
        selectedSeasonId,
        studentId,
        isContinuous,
        isContinuous ? previousEnrollment?.season_id : undefined,
        registrationDate  // 시즌 중간 합류 일할계산을 위한 등록일
      );
      setPreview(previewData);
    } catch (err: unknown) {
      console.warn('시즌 등록 미리보기를 불러오지 못했습니다.', err);
      setPreview(null);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setPreviewError('이미 이 시즌에 등록되어 있습니다.');
        } else {
          setPreviewError('일할 금액을 미리 계산하지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      } else {
        setPreviewError('일할 금액을 미리 계산하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedSeasonId, enrollments, studentId, isContinuous, registrationDate]);

  useEffect(() => {
    if (studentType === 'adult') return;
    loadData();
  }, [loadData, studentType]);

  useEffect(() => {
    if (studentType === 'adult') return;
    if (selectedSeasonId && showEnrollModal) {
      loadPreview();
    }
  }, [loadPreview, selectedSeasonId, showEnrollModal, studentType]);

  if (studentType === 'adult') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">시즌 등록 대상이 아닙니다</h3>
          <p className="text-gray-500">
            성인/공무원 학생은 시즌 시스템 대신 연중 월회비로 관리됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleEnroll = async () => {
    if (!selectedSeasonId) return;

    try {
      setEnrolling(true);
      const previousEnrollment = enrollments.find(e =>
        e.status === 'completed' || e.status === 'active'
      );

      const selectedSeason = activeSeasons.find(s => s.id === selectedSeasonId);
      const seasonFee = preview?.final_calculation?.season_fee ||
        (selectedSeason ? parseFloat(selectedSeason.default_season_fee) : 0);

      await seasonsApi.enrollStudent(selectedSeasonId, {
        student_id: studentId,
        season_fee: seasonFee,
        registration_date: registrationDate,  // 시즌 중간 합류를 위한 등록일
        is_continuous: isContinuous,
        previous_season_id: isContinuous ? previousEnrollment?.season_id : undefined,
      }, { suppressErrorToast: true });

      toast.success('시즌 등록이 완료되었습니다.');
      setShowEnrollModal(false);
      setSelectedSeasonId(null);
      setIsContinuous(false);
      setRegistrationDate(new Date().toISOString().split('T')[0]);
      setPreview(null);
      loadData();
    } catch (err: unknown) {
      console.warn('시즌 등록에 실패했습니다.', err);
      toast.error('시즌 등록을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleEditClick = (enrollment: StudentSeason) => {
    setEditError(null);
    setEditingEnrollment(enrollment);
    setEditData({
      registration_date: enrollment.registration_date || '',
      season_fee: parseFloat(String(enrollment.season_fee)) || 0,
      discount_amount: parseFloat(String(enrollment.discount_amount)) || 0,
      discount_reason: enrollment.discount_type === 'custom' ? '할인 적용' : '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEnrollment) return;

    try {
      setSaving(true);
      setEditError(null);
      await seasonsApi.updateEnrollment(editingEnrollment.id, {
        registration_date: editData.registration_date || undefined,
        season_fee: editData.season_fee,
        discount_amount: editData.discount_amount,
        discount_reason: editData.discount_reason || undefined,
      }, { suppressErrorToast: true });

      toast.success('시즌 등록 정보가 수정되었습니다.');
      setShowEditModal(false);
      setEditingEnrollment(null);
      loadData();
    } catch (err: unknown) {
      console.warn('시즌 등록 정보 수정에 실패했습니다.', err);
      setEditError('시즌 등록 정보를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenRefundModal = async (enrollment: StudentSeason) => {
    if (enrollment.payment_status !== 'paid') {
      toast.error('완납된 시즌만 환불 처리할 수 있습니다.');
      return;
    }

    try {
      setRefundLoading(true);
      setSelectedEnrollmentForRefund(enrollment);
      const today = new Date().toISOString().split('T')[0];
      const preview = await seasonsApi.getRefundPreview(enrollment.id, today, false);
      setRefundPreview(preview);
      setRefundModalOpen(true);
    } catch (err) {
      console.warn('시즌 환불 미리보기를 불러오지 못했습니다.', err);
      setSelectedEnrollmentForRefund(null);
      toast.error('환불 금액을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleConfirmRefund = async (includeVat: boolean, finalAmount: number) => {
    if (!selectedEnrollmentForRefund) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await seasonsApi.cancelEnrollmentWithRefund(
        selectedEnrollmentForRefund.id,
        today,
        includeVat,
        finalAmount
      );
      toast.success('환불 처리가 완료되었습니다.');
      setRefundModalOpen(false);
      setRefundPreview(null);
      setSelectedEnrollmentForRefund(null);
      loadData();
    } catch (err) {
      console.warn('시즌 환불 처리에 실패했습니다.', err);
      toast.error('환불 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleRequestCancelEnrollment = (enrollment: StudentSeason) => {
    setCancelTarget(enrollment);
  };

  const handleConfirmCancelEnrollment = async () => {
    if (!cancelTarget) return;

    try {
      setCanceling(true);
      await seasonsApi.cancelEnrollment(cancelTarget.season_id, studentId);
      toast.success('시즌 등록이 취소되었습니다.');
      setCancelTarget(null);
      loadData();
    } catch (err) {
      console.warn('시즌 등록 취소에 실패했습니다.', err);
      toast.error('시즌 등록을 취소하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setCanceling(false);
    }
  };

  const enrolledSeasonIds = new Set(enrollments.map(e => e.season_id));
  const availableSeasons = activeSeasons.filter(s => !enrolledSeasonIds.has(s.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">시즌 정보 로딩 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={loadData}>다시 시도</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StudentSeasonHistoryCard
        availableSeasonCount={availableSeasons.length}
        enrollments={enrollments}
        refundLoading={refundLoading}
        selectedEnrollmentForRefund={selectedEnrollmentForRefund}
        onCancel={handleRequestCancelEnrollment}
        onEdit={handleEditClick}
        onOpenEnroll={() => setShowEnrollModal(true)}
        onRefund={handleOpenRefundModal}
      />

      {showEditModal && editingEnrollment && (
        <StudentSeasonEditModal
          editingEnrollment={editingEnrollment}
          editData={editData}
          saving={saving}
          errorMessage={editError}
          onClose={() => {
            setShowEditModal(false);
            setEditingEnrollment(null);
            setEditError(null);
          }}
          onSave={handleSaveEdit}
          onEditDataChange={setEditData}
        />
      )}

      {showEnrollModal && (
        <StudentSeasonEnrollModal
          availableSeasons={availableSeasons}
          enrollments={enrollments}
          selectedSeasonId={selectedSeasonId}
          registrationDate={registrationDate}
          isContinuous={isContinuous}
          preview={preview}
          previewLoading={previewLoading}
          previewError={previewError}
          enrolling={enrolling}
          onSeasonChange={setSelectedSeasonId}
          onRegistrationDateChange={setRegistrationDate}
          onContinuousChange={setIsContinuous}
          onClose={() => {
            setShowEnrollModal(false);
            setSelectedSeasonId(null);
            setIsContinuous(false);
            setRegistrationDate(new Date().toISOString().split('T')[0]);
            setPreview(null);
            setPreviewError(null);
          }}
          onEnroll={handleEnroll}
        />
      )}

      {refundPreview && (
        <RefundModal
          isOpen={refundModalOpen}
          onClose={() => {
            setRefundModalOpen(false);
            setRefundPreview(null);
            setSelectedEnrollmentForRefund(null);
          }}
          enrollment={refundPreview.enrollment}
          cancellationDate={refundPreview.cancellation_date}
          refund={refundPreview.refund}
          academy={refundPreview.academy}
          onConfirm={handleConfirmRefund}
        />
      )}

      <StudentSeasonCancelDialog
        busy={canceling}
        enrollment={cancelTarget}
        open={cancelTarget !== null}
        onConfirm={handleConfirmCancelEnrollment}
        onOpenChange={(open) => {
          if (!open && !canceling) setCancelTarget(null);
        }}
      />
    </div>
  );
}
