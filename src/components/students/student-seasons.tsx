'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Trophy,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Banknote,
  Edit2,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import axios from 'axios';
import type { Season, StudentSeason, ProRatedPreview, RefundPreviewResponse } from '@/lib/types/season';
import { RefundModal } from '@/components/refund/refund-modal';
import {
  STUDENT_SEASON_STATUS_LABELS,
  formatSeasonFee,
} from '@/lib/types/season';
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

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPreview, setRefundPreview] = useState<RefundPreviewResponse | null>(null);
  const [selectedEnrollmentForRefund, setSelectedEnrollmentForRefund] = useState<StudentSeason | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

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
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
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
      console.error('Preview load failed:', err);
      setPreview(null);
      if (axios.isAxiosError(err)) {
        console.log('Axios error response:', err.response?.status, err.response?.data);
        const message = err.response?.data?.message;
        if (err.response?.status === 409) {
          setPreviewError(message || '이미 이 시즌에 등록되어 있습니다.');
        } else {
          setPreviewError(message || '프리뷰를 불러오는데 실패했습니다.');
        }
      } else {
        setPreviewError('프리뷰를 불러오는데 실패했습니다.');
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
          <h3 className="text-lg font-semibold text-foreground mb-2">시즌 등록 대상이 아닙니다</h3>
          <p className="text-muted-foreground">
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
      });

      toast.success('시즌 등록이 완료되었습니다.');
      setShowEnrollModal(false);
      setSelectedSeasonId(null);
      setIsContinuous(false);
      setRegistrationDate(new Date().toISOString().split('T')[0]);
      setPreview(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '시즌 등록에 실패했습니다.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleEditClick = (enrollment: StudentSeason) => {
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
      await seasonsApi.updateEnrollment(editingEnrollment.id, {
        registration_date: editData.registration_date || undefined,
        season_fee: editData.season_fee,
        discount_amount: editData.discount_amount,
        discount_reason: editData.discount_reason || undefined,
      });

      toast.success('시즌 등록 정보가 수정되었습니다.');
      setShowEditModal(false);
      setEditingEnrollment(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수정에 실패했습니다.');
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
      console.error('Failed to load refund preview:', err);

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
      console.error('Failed to process refund:', err);

    }
  };

  const handleCancelEnrollment = async (enrollment: StudentSeason) => {
    if (!confirm(`${enrollment.season_name} 등록을 취소하시겠습니까?`)) return;

    try {
      await seasonsApi.cancelEnrollment(enrollment.season_id, studentId);
      toast.success('시즌 등록이 취소되었습니다.');
      loadData();
    } catch (err) {
      console.error('Failed to cancel enrollment:', err);

    }
  };

  const enrolledSeasonIds = new Set(enrollments.map(e => e.season_id));
  const availableSeasons = activeSeasons.filter(s => !enrolledSeasonIds.has(s.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">시즌 정보 로딩 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadData}>다시 시도</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {availableSeasons.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setShowEnrollModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            시즌 등록
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Trophy className="w-5 h-5 mr-2" />
            시즌 등록 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">등록된 시즌이 없습니다.</p>
              {availableSeasons.length > 0 && (
                <Button className="mt-4" onClick={() => setShowEnrollModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  시즌 등록하기
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments.map((enrollment, index) => (
                <div
                  key={enrollment.id || `enrollment-${index}`}
                  className="p-4 border border-border rounded-lg hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">
                        {enrollment.season_name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          등록일: {enrollment.registration_date || '미지정'}
                        </span>
                        <span className="flex items-center">
                          <Banknote className="w-4 h-4 mr-1" />
                          시즌비: {formatSeasonFee(
                            (parseFloat(enrollment.season_fee) > 0 ? enrollment.season_fee : null) ||
                            (parseFloat(enrollment.final_fee) > 0 ? enrollment.final_fee : null) ||
                            '0'
                          )}
                        </span>
                        {parseFloat(String(enrollment.discount_amount)) > 0 && (
                          <span className="text-red-600">
                            (할인: {Math.floor(parseFloat(String(enrollment.discount_amount))).toLocaleString()}원)
                          </span>
                        )}
                        {!!enrollment.is_continuous && (
                          <span className="text-green-600 flex items-center">
                            <Check className="w-4 h-4 mr-1" />
                            연속등록
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {(enrollment.status === 'active' || enrollment.status === 'registered') && (
                        <>
                          <button
                            onClick={() => handleEditClick(enrollment)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {enrollment.payment_status === 'paid' ? (
                            <button
                              onClick={() => handleOpenRefundModal(enrollment)}
                              disabled={refundLoading}
                              className="px-3 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                              title="환불"
                            >
                              {refundLoading && selectedEnrollmentForRefund?.id === enrollment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="w-3 h-3 inline mr-1" />
                                  환불
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCancelEnrollment(enrollment)}
                              className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              title="취소"
                            >
                              취소
                            </button>
                          )}
                        </>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          enrollment.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : enrollment.status === 'registered'
                            ? 'bg-blue-100 text-blue-800'
                            : enrollment.status === 'completed'
                            ? 'bg-muted text-foreground'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {STUDENT_SEASON_STATUS_LABELS[enrollment.status]}
                      </span>
                      {(enrollment.status === 'active' || enrollment.status === 'registered') && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            enrollment.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : enrollment.payment_status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {enrollment.payment_status === 'paid' ? '완납' : enrollment.payment_status === 'partial' ? '일부납부' : '미납'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showEditModal && editingEnrollment && (
        <StudentSeasonEditModal
          editingEnrollment={editingEnrollment}
          editData={editData}
          saving={saving}
          onClose={() => {
            setShowEditModal(false);
            setEditingEnrollment(null);
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
    </div>
  );
}
