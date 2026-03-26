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
import axios from 'axios';
import type { Season, StudentSeason, ProRatedPreview, RefundPreviewResponse } from '@/lib/types/season';
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
  const [preview, setPreview] = useState<ProRatedPreview | null>(null);
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
  };

  const loadPreview = async () => {
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
      // 이미 등록된 경우 에러 메시지 표시
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
  };

  const handleEnroll = async () => {
    if (!selectedSeasonId) return;

    try {
      setEnrolling(true);
      const previousEnrollment = enrollments.find(e =>
        e.status === 'completed' || e.status === 'active'
      );

      // 선택된 시즌 정보에서 기본 시즌비 가져오기
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

  // 수정 모달 열기
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

  // 수정 저장
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

  // 환불 모달 열기
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

  // 환불 처리 확정
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

  // 미납 시즌 취소
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
                        {enrollment.season_name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
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
                      {/* 진행 중인 시즌만 수정/환불/취소 가능 */}
                      {(enrollment.status === 'active' || enrollment.status === 'registered') && (
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
                          enrollment.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : enrollment.status === 'registered'
                            ? 'bg-blue-100 text-blue-800'
                            : enrollment.status === 'completed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {STUDENT_SEASON_STATUS_LABELS[enrollment.status]}
                      </span>
                      {/* 납부 상태 표시 */}
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
                <p className="font-medium text-blue-900">{editingEnrollment.season_name}</p>
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
                      {season.season_name} ({SEASON_TYPE_LABELS[season.season_type]})
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
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                      {/* 시즌비 (일할 전 원래 금액 표시) */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">시즌비</span>
                        <span>
                          {formatSeasonFee(preview.final_calculation.original_season_fee || preview.final_calculation.season_fee)}
                        </span>
                      </div>

                      {/* 시즌 중간 합류 일할계산 */}
                      {preview.mid_season_prorated && (
                        <div className="flex justify-between text-orange-600">
                          <span>
                            중간합류 할인 ({preview.mid_season_prorated.remaining_days}/{preview.mid_season_prorated.total_days}일)
                          </span>
                          <span>-{formatSeasonFee(preview.mid_season_prorated.discount)}</span>
                        </div>
                      )}

                      {/* 비시즌 일할 안내 (시즌 전달 학원비에서 별도 청구) */}
                      {preview.non_season_prorated_info && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-1">
                          💡 비시즌 일할 {formatSeasonFee(preview.non_season_prorated_info.amount)}은(는) 시즌 전달 학원비에서 별도 청구됩니다.
                        </div>
                      )}

                      {/* 연속등록 할인 */}
                      {preview.final_calculation.discount_amount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>연속등록 할인</span>
                          <span>-{formatSeasonFee(preview.final_calculation.discount_amount)}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>총 납부액</span>
                        <span className="text-primary-600">
                          {formatSeasonFee(preview.final_calculation.total_due)}
                        </span>
                      </div>

                      {/* 시즌 중간 합류 안내 */}
                      {preview.mid_season_prorated && (
                        <div className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
                          {preview.mid_season_prorated.details}
                        </div>
                      )}
                    </div>
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
