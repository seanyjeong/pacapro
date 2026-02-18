'use client';

import { useState, useEffect } from 'react';
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
  X,
  RotateCcw,
} from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import type { Season, StudentSeason, RefundPreviewResponse } from '@/lib/types/season';
import { RefundModal } from '@/components/refund/refund-modal';
import {
  SEASON_TYPE_LABELS,
  STUDENT_SEASON_STATUS_LABELS,
  formatSeasonFee,
} from '@/lib/types/season';

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

  // 시즌 등록 모달 상태
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [isContinuous, setIsContinuous] = useState(false);
  const [registrationDate, setRegistrationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // 시즌 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<StudentSeason | null>(null);
  const [editData, setEditData] = useState({
    registration_date: '',
    season_fee: 0,
    discount_amount: 0,
    discount_reason: '',
  });
  const [saving, setSaving] = useState(false);

  // 환불 모달 상태
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPreview, setRefundPreview] = useState<RefundPreviewResponse | null>(null);
  const [selectedEnrollmentForRefund, setSelectedEnrollmentForRefund] = useState<StudentSeason | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  // 공무원/성인은 시즌 시스템 미사용
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

  useEffect(() => {
    loadData();
  }, [studentId]);

  useEffect(() => {
    if (selectedSeasonId && showEnrollModal) {
      loadPreview();
    }
  }, [selectedSeasonId, isContinuous, registrationDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 병렬로 데이터 로드
      const [enrollmentsData, activeSeason] = await Promise.all([
        seasonsApi.getStudentSeasonHistory(studentId),
        seasonsApi.getActiveSeason(),
      ]);

      setEnrollments(enrollmentsData);
      setActiveSeasons(activeSeason ? [activeSeason] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    if (!selectedSeasonId) return;

    try {
      setPreviewLoading(true);
      setPreviewError(null);
      // Simple client-side preview based on selected season
      const selectedSeason = activeSeasons.find(s => s.id === selectedSeasonId);
      if (selectedSeason) {
        const seasonFee = selectedSeason.fee || 0;
        setPreview({
          final_calculation: {
            season_fee: seasonFee,
            original_season_fee: seasonFee,
            discount_amount: 0,
            total_due: seasonFee,
          },
        });
      }
    } catch (err: unknown) {
      console.error('Preview load failed:', err);
      setPreview(null);
      setPreviewError('프리뷰를 불러오는데 실패했습니다.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSeasonId) return;

    try {
      setEnrolling(true);
      const previousEnrollment = enrollments.find(e =>
        e.status === 'completed' || e.status === 'enrolled'
      );

      // 선택된 시즌 정보에서 기본 시즌비 가져오기
      const selectedSeason = activeSeasons.find(s => s.id === selectedSeasonId);
      const finalCalc = preview?.final_calculation as { season_fee?: number } | undefined;
      const seasonFee = finalCalc?.season_fee ?? (selectedSeason?.fee || 0);

      await seasonsApi.enrollStudent(selectedSeasonId, {
        student_id: studentId,
        fee: seasonFee,
        enrollment_date: registrationDate,
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

  // 수정 모달 열기
  const handleEditClick = (enrollment: StudentSeason) => {
    setEditingEnrollment(enrollment);
    setEditData({
      registration_date: enrollment.enrollment_date || '',
      season_fee: enrollment.fee || 0,
      discount_amount: parseFloat(String(enrollment.discount_amount)) || 0,
      discount_reason: enrollment.discount_type === 'custom' ? '할인 적용' : '',
    });
    setShowEditModal(true);
  };

  // 수정 저장
  const handleSaveEdit = async () => {
    if (!editingEnrollment) return;

    try {
      setSaving(true);
      await seasonsApi.updateEnrollmentById(editingEnrollment.id, {
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

  // 환불 모달 열기
  const handleOpenRefundModal = async (enrollment: StudentSeason) => {
    if (enrollment.payment_status !== 'paid') {
      toast.error('완납된 시즌만 환불 처리할 수 있습니다.');
      return;
    }

    try {
      setRefundLoading(true);
      setSelectedEnrollmentForRefund(enrollment);
      const refundData = await seasonsApi.getRefundPreview(enrollment.id);
      setRefundPreview(refundData);
      setRefundModalOpen(true);
    } catch (err) {
      console.error('Failed to load refund preview:', err);
      toast.error('환불 정보를 불러오는데 실패했습니다.');
    } finally {
      setRefundLoading(false);
    }
  };

  // 환불 처리 확정
  const handleConfirmRefund = async (includeVat: boolean, finalAmount: number) => {
    if (!selectedEnrollmentForRefund) return;

    try {
      await seasonsApi.cancelEnrollmentById(selectedEnrollmentForRefund.id);
      toast.success('환불 처리가 완료되었습니다.');
      setRefundModalOpen(false);
      setRefundPreview(null);
      setSelectedEnrollmentForRefund(null);
      loadData();
    } catch (err) {
      console.error('Failed to process refund:', err);
      toast.error('환불 처리에 실패했습니다.');
    }
  };

  // 미납 시즌 취소
  const handleCancelEnrollment = async (enrollment: StudentSeason) => {
    if (!confirm(`${enrollment.season?.name || enrollment.season_name || '시즌'} 등록을 취소하시겠습니까?`)) return;

    try {
      await seasonsApi.cancelEnrollment(enrollment.season_id, studentId);
      toast.success('시즌 등록이 취소되었습니다.');
      loadData();
    } catch (err) {
      console.error('Failed to cancel enrollment:', err);
      toast.error('취소 처리에 실패했습니다.');
    }
  };

  // 미등록 시즌 필터링
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
      {/* 시즌 등록 버튼 */}
      {availableSeasons.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setShowEnrollModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            시즌 등록
          </Button>
        </div>
      )}

      {/* 등록된 시즌 목록 */}
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
              <p className="text-gray-500">등록된 시즌이 없습니다.</p>
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
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {enrollment.season?.name || enrollment.season_name || '시즌'}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          등록일: {enrollment.enrollment_date || '미지정'}
                        </span>
                        <span className="flex items-center">
                          <Banknote className="w-4 h-4 mr-1" />
                          시즌비: {formatSeasonFee(enrollment.fee)}
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
                      {/* 진행 중인 시즌만 수정/환불/취소 가능 */}
                      {(enrollment.status === 'enrolled') && (
                        <>
                          <button
                            onClick={() => handleEditClick(enrollment)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
                          enrollment.status === 'enrolled'
                            ? 'bg-green-100 text-green-800'
                            : enrollment.status === 'completed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {STUDENT_SEASON_STATUS_LABELS[enrollment.status] || enrollment.status}
                      </span>
                      {/* 납부 상태 표시 */}
                      {(enrollment.status === 'enrolled') && (
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

      {/* 시즌 수정 모달 */}
      {showEditModal && editingEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">시즌 등록 정보 수정</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEnrollment(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-900">{editingEnrollment.season?.name || editingEnrollment.season_name || '시즌'}</p>
              </div>

              {/* 등록일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등록일
                </label>
                <input
                  type="date"
                  value={editData.registration_date}
                  onChange={(e) => setEditData({ ...editData, registration_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  시즌 시작일 이후로 설정하면 일할계산이 적용됩니다.
                </p>
              </div>

              {/* 시즌비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌비
                </label>
                <input
                  type="number"
                  value={editData.season_fee || ''}
                  onChange={(e) => setEditData({ ...editData, season_fee: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  min="0"
                  step="10000"
                />
                <p className="text-xs text-gray-500 mt-1">1만원 단위</p>
              </div>

              {/* 할인 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  할인 금액
                </label>
                <input
                  type="number"
                  value={editData.discount_amount || ''}
                  onChange={(e) => setEditData({ ...editData, discount_amount: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  min="0"
                  step="10000"
                />
                <p className="text-xs text-gray-500 mt-1">1만원 단위</p>
              </div>

              {/* 최종 시즌비 표시 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">시즌비</span>
                  <span>{editData.season_fee.toLocaleString()}원</span>
                </div>
                {editData.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600 mt-1">
                    <span>할인</span>
                    <span>-{editData.discount_amount.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                  <span>최종 금액</span>
                  <span className="text-primary-600">
                    {Math.max(0, editData.season_fee - editData.discount_amount).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEnrollment(null);
                }}
                disabled={saving}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 시즌 등록 모달 */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">시즌 등록</h3>

            <div className="space-y-4">
              {/* 시즌 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등록할 시즌 선택
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={selectedSeasonId || ''}
                  onChange={e => setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">시즌을 선택하세요</option>
                  {availableSeasons.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.name} {season.season_type ? `(${SEASON_TYPE_LABELS[season.season_type]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 등록일 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등록일 (시즌 시작 후 합류 시 일할계산)
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={registrationDate}
                  onChange={e => setRegistrationDate(e.target.value)}
                />
              </div>

              {/* 연속등록 여부 */}
              {enrollments.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="continuous"
                    checked={isContinuous}
                    onChange={e => setIsContinuous(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="continuous" className="text-sm text-gray-700">
                    연속등록 (이전 시즌에서 이어서 등록)
                  </label>
                </div>
              )}

              {/* 미리보기 */}
              {selectedSeasonId && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">납부 예상 금액</h4>
                  {previewLoading ? (
                    <div className="flex items-center text-gray-500">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      계산 중...
                    </div>
                  ) : previewError ? (
                    <div className="bg-red-50 p-4 rounded-lg flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{previewError}</span>
                    </div>
                  ) : preview?.final_calculation ? (
                    (() => {
                      const calc = preview.final_calculation as { season_fee?: number; discount_amount?: number; total_due?: number };
                      return (
                        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">시즌비</span>
                            <span>{formatSeasonFee(calc.season_fee || 0)}</span>
                          </div>

                          {(calc.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>할인</span>
                              <span>-{formatSeasonFee(calc.discount_amount || 0)}</span>
                            </div>
                          )}

                          <div className="flex justify-between font-semibold border-t pt-2">
                            <span>총 납부액</span>
                            <span className="text-primary-600">
                              {formatSeasonFee(calc.total_due || 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-gray-500 text-sm">시즌을 선택해주세요.</p>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEnrollModal(false);
                  setSelectedSeasonId(null);
                  setIsContinuous(false);
                  setRegistrationDate(new Date().toISOString().split('T')[0]);
                  setPreview(null);
                  setPreviewError(null);
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleEnroll}
                disabled={!selectedSeasonId || enrolling || !!previewError}
              >
                {enrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                등록
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 환불 모달 */}
      {refundPreview && selectedEnrollmentForRefund && (
        <RefundModal
          isOpen={refundModalOpen}
          onClose={() => {
            setRefundModalOpen(false);
            setRefundPreview(null);
            setSelectedEnrollmentForRefund(null);
          }}
          enrollment={{
            id: selectedEnrollmentForRefund.id,
            student_name: selectedEnrollmentForRefund.student_name || '',
            season_name: selectedEnrollmentForRefund.season?.name || selectedEnrollmentForRefund.season_name || '',
            season_start_date: selectedEnrollmentForRefund.season?.start_date || '',
            season_end_date: selectedEnrollmentForRefund.season?.end_date || '',
            original_fee: selectedEnrollmentForRefund.fee,
            discount_amount: parseFloat(String(selectedEnrollmentForRefund.discount_amount || '0')) || 0,
            paid_amount: selectedEnrollmentForRefund.paid_amount,
            payment_status: selectedEnrollmentForRefund.payment_status,
          }}
          cancellationDate={new Date().toISOString().split('T')[0]}
          refund={{
            paidAmount: refundPreview.paid_amount,
            originalFee: refundPreview.fee,
            discountAmount: 0,
            totalClassDays: refundPreview.total_days,
            attendedDays: refundPreview.used_days,
            remainingDays: refundPreview.remaining_days,
            progressRate: refundPreview.total_days > 0 ? `${Math.round(refundPreview.used_days / refundPreview.total_days * 100)}%` : '0%',
            usedAmount: refundPreview.paid_amount - refundPreview.refund_amount,
            usedRate: `${Math.round((1 - refundPreview.refund_ratio) * 100)}%`,
            refundAmount: refundPreview.refund_amount,
            refundRate: `${Math.round(refundPreview.refund_ratio * 100)}%`,
            includeVat: false,
            vatAmount: 0,
            refundAfterVat: refundPreview.refund_amount,
            legalRefundRate: `${Math.round(refundPreview.refund_ratio * 100)}%`,
            legalRefundReason: '일할계산',
            legalRefundAmount: refundPreview.refund_amount,
            finalRefundAmount: refundPreview.refund_amount,
            calculationDetails: {
              paidAmount: `${refundPreview.paid_amount.toLocaleString()}원`,
              perClassFee: refundPreview.total_days > 0 ? `${Math.round(refundPreview.fee / refundPreview.total_days).toLocaleString()}원` : '0원',
              usedFormula: `${refundPreview.used_days}일 × 일당금액`,
              refundFormula: '납부액 - 사용액',
              vatFormula: null,
            },
          }}
          academy={{}}
          onConfirm={handleConfirmRefund}
        />
      )}
    </div>
  );
}
