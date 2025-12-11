'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Trophy,
  Calendar,
  Users,
  DollarSign,
  XCircle,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { seasonsApi } from '@/lib/api/seasons';
import type { Season, StudentSeason, RefundData, RefundPreviewResponse } from '@/lib/types/season';
import {
  SEASON_TYPE_LABELS,
  SEASON_STATUS_LABELS,
  formatSeasonFee,
  formatOperatingDays,
  parseOperatingDays,
  TIME_SLOT_LABELS,
  SEASON_TARGET_GRADES,
} from '@/lib/types/season';
import type { GradeTimeSlots } from '@/lib/types/season';
import { RefundModal } from '@/components/refund/refund-modal';

export default function SeasonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = parseInt(params.id as string);

  const [season, setSeason] = useState<Season | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [updatingTimeSlotId, setUpdatingTimeSlotId] = useState<number | null>(null);

  // 환불 모달 상태
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<StudentSeason | null>(null);
  const [refundPreview, setRefundPreview] = useState<RefundPreviewResponse | null>(null);
  const [cancellationDate, setCancellationDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchSeason = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await seasonsApi.getSeason(seasonId);
      setSeason(response.season);

      // 등록 학생 목록 조회
      try {
        const students = await seasonsApi.getEnrolledStudents(seasonId);
        setEnrolledStudents(students);
      } catch {
        // 학생 목록 조회 실패는 무시
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '시즌 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (seasonId) {
      fetchSeason();
    }
  }, [seasonId, fetchSeason]);

  const handleDelete = async () => {
    if (!season) return;
    if (!confirm(`"${season.season_name}" 시즌을 삭제하시겠습니까?\n등록된 학생이 있으면 삭제할 수 없습니다.`)) return;

    try {
      await seasonsApi.deleteSeason(seasonId);
      router.push('/seasons');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  // 환불 모달 열기 (환불 미리보기 조회)
  const handleOpenRefundModal = async (enrollment: StudentSeason) => {
    setSelectedEnrollment(enrollment);
    setRefundLoading(true);
    setRefundModalOpen(true);

    try {
      const preview = await seasonsApi.getRefundPreview(
        enrollment.id,
        cancellationDate,
        false
      );
      setRefundPreview(preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '환불 정보 조회에 실패했습니다.');
      setRefundModalOpen(false);
    } finally {
      setRefundLoading(false);
    }
  };

  // 환불 확정 처리
  const handleConfirmRefund = async (includeVat: boolean, finalAmount: number) => {
    if (!selectedEnrollment) return;

    try {
      await seasonsApi.cancelEnrollmentWithRefund(
        selectedEnrollment.id,
        cancellationDate,
        includeVat,
        finalAmount
      );
      toast.success(`${selectedEnrollment.student_name} 학생의 시즌 등록이 취소되었습니다.`);
      setRefundModalOpen(false);
      setSelectedEnrollment(null);
      setRefundPreview(null);

      // 목록 새로고침
      const students = await seasonsApi.getEnrolledStudents(seasonId);
      setEnrolledStudents(students);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '환불 처리에 실패했습니다.');
    }
  };

  // 기존 간단 취소 (미납 상태일 때)
  const handleCancelEnrollment = async (enrollment: StudentSeason) => {
    // 완납 상태면 환불 모달 열기
    if (enrollment.payment_status === 'paid') {
      handleOpenRefundModal(enrollment);
      return;
    }

    // 미납 상태면 간단 취소
    if (!confirm(`${enrollment.student_name} 학생의 시즌 등록을 취소하시겠습니까?`)) return;

    try {
      setCancellingId(enrollment.id);
      await seasonsApi.cancelEnrollment(seasonId, enrollment.student_id);
      toast.success('시즌 등록이 취소되었습니다.');
      // 목록 새로고침
      const students = await seasonsApi.getEnrolledStudents(seasonId);
      setEnrolledStudents(students);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  };

  // 학생의 시간대 가져오기 (enrollment 또는 시즌 설정에서)
  const getEnrollmentTimeSlots = useCallback((enrollment: StudentSeason): string[] => {
    // 개별 설정이 있으면 사용
    if (enrollment.time_slots) {
      return typeof enrollment.time_slots === 'string'
        ? JSON.parse(enrollment.time_slots)
        : enrollment.time_slots;
    }
    // 없으면 시즌 설정에서 학년별 기본값 사용
    if (season?.grade_time_slots) {
      const gradeTimeSlots = typeof season.grade_time_slots === 'string'
        ? JSON.parse(season.grade_time_slots)
        : season.grade_time_slots;
      const studentGrade = enrollment.student_grade || '';
      if (gradeTimeSlots[studentGrade]) {
        return gradeTimeSlots[studentGrade];
      }
    }
    // 기본값: 저녁
    return ['evening'];
  }, [season]);

  // 시간대 즉시 변경 핸들러
  const handleTimeSlotChange = async (enrollment: StudentSeason, slot: string) => {
    // 현재 시간대 파싱
    const currentSlots = getEnrollmentTimeSlots(enrollment);

    // 토글 (이미 있으면 제거, 없으면 추가)
    let newSlots: string[];
    if (currentSlots.includes(slot)) {
      newSlots = currentSlots.filter((s: string) => s !== slot);
    } else {
      newSlots = [...currentSlots, slot];
    }

    // 최소 1개는 선택되어야 함
    if (newSlots.length === 0) {
      toast.error('최소 1개의 시간대를 선택해야 합니다.');
      return;
    }

    try {
      setUpdatingTimeSlotId(enrollment.id);
      await seasonsApi.updateEnrollment(enrollment.id, { time_slots: newSlots });

      // 로컬 상태 즉시 업데이트
      setEnrolledStudents(prev => prev.map(e =>
        e.id === enrollment.id ? { ...e, time_slots: newSlots as ('morning' | 'afternoon' | 'evening')[] } : e
      ));
      toast.success('시간대가 변경되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '시간대 변경에 실패했습니다.');
    } finally {
      setUpdatingTimeSlotId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {error || '시즌을 찾을 수 없습니다.'}
            </h3>
            <Button onClick={() => router.push('/seasons')}>목록으로</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const operatingDays = parseOperatingDays(season.operating_days);
  const gradeTimeSlots = typeof season.grade_time_slots === 'string'
    ? JSON.parse(season.grade_time_slots) as GradeTimeSlots
    : season.grade_time_slots;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/seasons')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-foreground">{season.season_name}</h1>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                season.season_type === 'early' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
              }`}>
                {SEASON_TYPE_LABELS[season.season_type]}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                season.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : season.status === 'draft'
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {SEASON_STATUS_LABELS[season.status] || season.status}
              </span>
            </div>
            <p className="text-muted-foreground">{new Date(season.season_start_date).getFullYear()}년</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push(`/seasons/${seasonId}/edit`)}>
            <Edit2 className="w-4 h-4 mr-2" />
            수정
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            삭제
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">시즌 기간</p>
                <p className="font-medium">{season.season_start_date}</p>
                <p className="font-medium">~ {season.season_end_date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">시즌비</p>
                <p className="text-xl font-bold">{formatSeasonFee(season.default_season_fee)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">운영 요일</p>
                <p className="font-medium">{formatOperatingDays(operatingDays)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">등록 학생</p>
                <p className="text-xl font-bold">{enrolledStudents.length}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">시즌 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">비시즌 종강일</p>
                <p className="font-medium">{season.non_season_end_date || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">연속등록 허용</p>
                <p className="font-medium">{season.allows_continuous ? '허용' : '불허'}</p>
              </div>
              {!!season.allows_continuous && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">연속등록 할인</p>
                    <p className="font-medium">
                      {season.continuous_discount_type === 'none' && '없음'}
                      {season.continuous_discount_type === 'free' && '무료'}
                      {season.continuous_discount_type === 'rate' && `${season.continuous_discount_rate}% 할인`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">연속등록 대상 시즌</p>
                    <p className="font-medium">
                      {season.continuous_to_season_type === 'early' && '수시'}
                      {season.continuous_to_season_type === 'regular' && '정시'}
                      {!season.continuous_to_season_type && '-'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">학년별 수업 시간대</CardTitle>
          </CardHeader>
          <CardContent>
            {gradeTimeSlots ? (
              <div className="space-y-2">
                {SEASON_TARGET_GRADES.map(grade => {
                  const slots = gradeTimeSlots[grade];
                  // 배열이 아니면 배열로 변환 (하위 호환성)
                  const slotArray = Array.isArray(slots) ? slots : (slots ? [slots] : []);
                  return (
                    <div key={grade} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="font-medium">{grade}</span>
                      <div className="flex gap-1">
                        {slotArray.length > 0 ? slotArray.map(slot => (
                          <span key={slot} className={`px-3 py-1 rounded-full text-sm ${
                            slot === 'morning' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                            slot === 'afternoon' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                            slot === 'evening' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {TIME_SLOT_LABELS[slot] || slot}
                          </span>
                        )) : (
                          <span className="px-3 py-1 rounded-full text-sm bg-muted text-muted-foreground">미설정</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">설정된 시간대가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Students */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">등록 학생 ({enrolledStudents.length}명)</CardTitle>
          <Button size="sm" onClick={() => router.push(`/seasons/${seasonId}/enroll`)}>
            학생 등록
          </Button>
        </CardHeader>
        <CardContent>
          {enrolledStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>등록된 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">학생명</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">시즌비</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">등록일</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">납부상태</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">시간대</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map(enrollment => {
                    const seasonFee = parseFloat(enrollment.season_fee) || 0; // 실제 납부할 금액
                    const discountAmount = parseFloat(enrollment.discount_amount || '0') || 0;
                    const originalFee = seasonFee + discountAmount; // 원래 금액 = 납부금액 + 할인금액
                    const hasDiscount = discountAmount > 0;

                    return (
                      <tr key={enrollment.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium text-foreground">{enrollment.student_name}</td>
                        <td className="py-2 px-3">
                          {hasDiscount ? (
                            <div className="flex flex-col">
                              <span className="line-through text-gray-400 text-sm">
                                {formatSeasonFee(originalFee.toString())}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-red-500 text-sm">-{formatSeasonFee(discountAmount.toString())}</span>
                                <span className="font-bold text-primary-600">{formatSeasonFee(seasonFee.toString())}</span>
                              </div>
                            </div>
                          ) : (
                            <span>{formatSeasonFee(enrollment.season_fee)}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-sm text-muted-foreground">
                          {enrollment.registration_date || enrollment.registered_at?.split('T')[0] || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            enrollment.payment_status === 'paid' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                            enrollment.payment_status === 'partial' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                            enrollment.payment_status === 'pending' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                            enrollment.payment_status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {enrollment.payment_status === 'paid' && '완납'}
                            {enrollment.payment_status === 'partial' && '일부납부'}
                            {enrollment.payment_status === 'pending' && '미납'}
                            {enrollment.payment_status === 'cancelled' && '취소됨'}
                            {!['paid', 'partial', 'pending', 'cancelled'].includes(enrollment.payment_status) && enrollment.payment_status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {enrollment.payment_status !== 'cancelled' && (
                            <div className="flex gap-1">
                              {(['morning', 'afternoon', 'evening'] as const).map(slot => {
                                const currentSlots = getEnrollmentTimeSlots(enrollment);
                                const isSelected = currentSlots.includes(slot);
                                const isUpdating = updatingTimeSlotId === enrollment.id;

                                return (
                                  <button
                                    key={slot}
                                    onClick={() => handleTimeSlotChange(enrollment, slot)}
                                    disabled={isUpdating}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      isSelected
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {TIME_SLOT_LABELS[slot]}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {enrollment.payment_status !== 'cancelled' && (
                            <div className="flex gap-1 justify-end">
                              {/* 완납 상태면 환불 버튼 표시 */}
                              {enrollment.payment_status === 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => handleOpenRefundModal(enrollment)}
                                >
                                  <Receipt className="w-4 h-4 mr-1" />
                                  환불
                                </Button>
                              )}
                              {/* 미납/일부납 상태면 취소 버튼 표시 */}
                              {enrollment.payment_status !== 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleCancelEnrollment(enrollment)}
                                  disabled={cancellingId === enrollment.id}
                                >
                                  {cancellingId === enrollment.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-1" />
                                      취소
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 환불 모달 */}
      <RefundModal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setSelectedEnrollment(null);
          setRefundPreview(null);
        }}
        enrollment={refundPreview?.enrollment || null}
        cancellationDate={refundPreview?.cancellation_date || cancellationDate}
        refund={refundPreview?.refund || null}
        academy={refundPreview?.academy || {}}
        onConfirm={handleConfirmRefund}
        loading={refundLoading}
      />
    </div>
  );
}
