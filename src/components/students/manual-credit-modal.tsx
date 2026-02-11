'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Calendar, Hash, AlertTriangle, Calculator, List, Trash2, Pencil, Loader2, Banknote } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ManualCreditModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  monthlyTuition: number;
  weeklyCount: number;
  classDays: number[];
  onSuccess: () => void;
}

interface Credit {
  id: number;
  credit_amount: number;
  remaining_amount: number;
  credit_type: string;
  status: string;
  rest_start_date: string;
  rest_end_date: string;
  rest_days: number;
  notes: string;
  created_at: string;
}

// 요일 이름
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 기간 내 수업 횟수 계산 (프론트 미리보기용)
function countClassDaysInPeriod(startDate: string, endDate: string, classDays: number[]) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const classDates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (classDays.includes(dayOfWeek)) {
      const month = current.getMonth() + 1;
      const day = current.getDate();
      const dayName = DAY_NAMES[dayOfWeek];
      classDates.push(`${month}/${day}(${dayName})`);
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    count: classDates.length,
    dates: classDates,
  };
}

// 사유 프리셋
const REASON_PRESETS = [
  { value: '시험기간', label: '시험기간' },
  { value: '경조사', label: '경조사' },
  { value: '병결', label: '병결' },
  { value: '기타', label: '기타' },
];

// 크레딧 타입 라벨
const CREDIT_TYPE_LABELS: Record<string, string> = {
  carryover: '이월',
  excused: '공결',
  manual: '수동',
  refund: '환불',
};

// 크레딧 상태 라벨
const CREDIT_STATUS_LABELS: Record<string, string> = {
  pending: '미사용',
  partial: '부분사용',
  applied: '크레딧사용',
  used: '사용됨',
  refunded: '환불완료',
  cancelled: '취소',
  expired: '만료',
};

export function ManualCreditModal({
  open,
  onClose,
  studentId,
  studentName,
  monthlyTuition,
  weeklyCount,
  classDays,
  onSuccess,
}: ManualCreditModalProps) {
  // 메인 탭: 'create' | 'manage'
  const [mainTab, setMainTab] = useState<'create' | 'manage'>('create');

  // 입력 모드: 'date' | 'count' | 'amount'
  const [inputMode, setInputMode] = useState<'date' | 'count' | 'amount'>('date');

  // 날짜 입력
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 회차 입력
  const [classCount, setClassCount] = useState<number>(1);

  // 금액 직접 입력
  const [directAmount, setDirectAmount] = useState<number>(0);

  // 공통
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // 크레딧 목록
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // 수정 모드
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  // 적용 모드
  const [applyingCredit, setApplyingCredit] = useState<Credit | null>(null);
  const [applyYearMonth, setApplyYearMonth] = useState<string>('');
  const [applying, setApplying] = useState(false);

  // 1회 금액 계산
  const perClassFee = useMemo(() => {
    const fee = monthlyTuition / (weeklyCount * 4);
    return Math.floor(fee / 1000) * 1000; // 천원 단위 절삭
  }, [monthlyTuition, weeklyCount]);

  // 날짜 기반 계산
  const dateCalculation = useMemo(() => {
    if (!startDate || !endDate || classDays.length === 0) {
      return { count: 0, dates: [], totalCredit: 0 };
    }
    const result = countClassDaysInPeriod(startDate, endDate, classDays);
    return {
      ...result,
      totalCredit: Math.floor((perClassFee * result.count) / 1000) * 1000,
    };
  }, [startDate, endDate, classDays, perClassFee]);

  // 회차 기반 계산
  const countCalculation = useMemo(() => {
    return {
      count: classCount,
      totalCredit: Math.floor((perClassFee * classCount) / 1000) * 1000,
    };
  }, [classCount, perClassFee]);

  // 금액 직접 입력 계산
  const amountCalculation = useMemo(() => {
    return {
      count: directAmount > 0 ? 1 : 0,
      totalCredit: directAmount > 0 ? directAmount : 0,
    };
  }, [directAmount]);

  // 현재 모드의 계산 결과
  const currentCalculation = inputMode === 'date' ? dateCalculation : inputMode === 'count' ? countCalculation : amountCalculation;

  // 최종 사유
  const finalReason = reason === '기타' ? customReason : reason;

  // 크레딧 목록 로드
  const loadCredits = async () => {
    try {
      setLoadingCredits(true);
      const response = await studentsAPI.getCredits(studentId);
      setCredits(response.credits || []);
    } catch (err) {
      console.error('크레딧 목록 로드 실패:', err);
    } finally {
      setLoadingCredits(false);
    }
  };

  // 탭 변경 시 크레딧 목록 로드
  useEffect(() => {
    if (open && mainTab === 'manage') {
      loadCredits();
    }
  }, [open, mainTab, studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!finalReason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }

    if (inputMode === 'date') {
      if (!startDate || !endDate) {
        setError('시작일과 종료일을 입력해주세요.');
        return;
      }
      if (dateCalculation.count === 0) {
        setError('해당 기간에 수업일이 없습니다.');
        return;
      }
    } else if (inputMode === 'count') {
      if (classCount < 1 || classCount > 12) {
        setError('회차는 1~12 사이로 입력해주세요.');
        return;
      }
    } else {
      if (!directAmount || directAmount < 1000) {
        setError('금액은 1,000원 이상 입력해주세요.');
        return;
      }
      if (directAmount > 10000000) {
        setError('금액은 10,000,000원 이하로 입력해주세요.');
        return;
      }
    }

    try {
      setProcessing(true);
      setError('');

      const data = inputMode === 'date'
        ? { start_date: startDate, end_date: endDate, reason: finalReason, notes: notes || undefined }
        : inputMode === 'count'
        ? { class_count: classCount, reason: finalReason, notes: notes || undefined }
        : { direct_amount: directAmount, reason: finalReason, notes: notes || undefined };

      const result = await studentsAPI.createManualCredit(studentId, data);

      toast.success('크레딧 생성 완료', {
        description: result.message,
      });

      onSuccess();
      resetForm();
      // 크레딧 목록 새로고침
      if (mainTab === 'manage') {
        loadCredits();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '크레딧 생성 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (creditId: number) => {
    if (!confirm('이 크레딧을 삭제하시겠습니까?')) return;

    try {
      await studentsAPI.deleteCredit(studentId, creditId);
      toast.success('크레딧이 삭제되었습니다.');
      loadCredits();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '크레딧 삭제에 실패했습니다.');
    }
  };

  const handleEdit = (credit: Credit) => {
    setEditingCredit(credit);
    setEditAmount(credit.credit_amount);
    setEditNotes(credit.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCredit) return;

    try {
      setProcessing(true);
      await studentsAPI.updateCredit(studentId, editingCredit.id, {
        credit_amount: editAmount,
        notes: editNotes,
      });
      toast.success('크레딧이 수정되었습니다.');
      setEditingCredit(null);
      loadCredits();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '크레딧 수정에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 적용 모달 열기
  const openApplyModal = (credit: Credit) => {
    setApplyingCredit(credit);
    const now = new Date();
    setApplyYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  // 적용 처리
  const handleApplyCredit = async () => {
    if (!applyingCredit || !applyYearMonth) return;

    try {
      setApplying(true);
      const result = await studentsAPI.applyCredit(studentId, applyingCredit.id, applyYearMonth);
      toast.success(result.message);
      setApplyingCredit(null);
      loadCredits();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '크레딧 적용에 실패했습니다.');
    } finally {
      setApplying(false);
    }
  };

  const resetForm = () => {
    setInputMode('date');
    setStartDate('');
    setEndDate('');
    setClassCount(1);
    setDirectAmount(0);
    setReason('');
    setCustomReason('');
    setNotes('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    setMainTab('create');
    setEditingCredit(null);
    onClose();
  };

  // 수업 요일 표시
  const classDaysText = classDays.length > 0
    ? classDays.map(d => DAY_NAMES[d]).join(', ')
    : '미설정';

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            크레딧 관리
          </DialogTitle>
          <DialogDescription>
            {studentName} 학생의 크레딧을 관리합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 메인 탭 */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'create' | 'manage')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              새 크레딧
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1">
              <List className="w-4 h-4" />
              크레딧 목록
            </TabsTrigger>
          </TabsList>

          {/* 새 크레딧 생성 */}
          <TabsContent value="create">
            <form onSubmit={handleSubmit}>
              <div className="py-6 px-6 space-y-4">
                {/* 학생 정보 */}
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div>월 수강료: <span className="font-medium">{monthlyTuition.toLocaleString()}원</span></div>
                  <div>주당 횟수: <span className="font-medium">{weeklyCount}회</span> (월 {weeklyCount * 4}회)</div>
                  <div>수업 요일: <span className="font-medium">{classDaysText}</span></div>
                  <div className="pt-1 border-t border-border mt-2">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      1회 금액: {perClassFee.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 입력 모드 탭 */}
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'date' | 'count' | 'amount')}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="date" className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      날짜로
                    </TabsTrigger>
                    <TabsTrigger value="count" className="flex items-center gap-1">
                      <Hash className="w-4 h-4" />
                      회차로
                    </TabsTrigger>
                    <TabsTrigger value="amount" className="flex items-center gap-1">
                      <Banknote className="w-4 h-4" />
                      금액 직접
                    </TabsTrigger>
                  </TabsList>

                  {/* 날짜로 입력 */}
                  <TabsContent value="date" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="startDate">시작일</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="endDate">종료일</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate}
                        />
                      </div>
                    </div>

                    {/* 날짜 계산 결과 */}
                    {startDate && endDate && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                        <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                          <Calculator className="w-4 h-4" />
                          계산 결과
                        </div>
                        {dateCalculation.count > 0 ? (
                          <>
                            <div className="text-blue-600 dark:text-blue-500">
                              해당 기간 수업일: {dateCalculation.dates.join(', ')}
                            </div>
                            <div className="text-blue-600 dark:text-blue-500">
                              수업 횟수: <span className="font-medium">{dateCalculation.count}회</span>
                            </div>
                            <div className="text-blue-700 dark:text-blue-400 font-medium mt-1">
                              총 크레딧: {dateCalculation.totalCredit.toLocaleString()}원
                            </div>
                          </>
                        ) : (
                          <div className="text-orange-600 dark:text-orange-400">
                            해당 기간에 수업일이 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* 회차로 입력 */}
                  <TabsContent value="count" className="space-y-3 mt-3">
                    <div className="space-y-1">
                      <Label htmlFor="classCount">회차</Label>
                      <Input
                        id="classCount"
                        type="number"
                        min={1}
                        max={12}
                        value={classCount || ''}
                        onChange={(e) => setClassCount(e.target.value === '' ? 0 : parseInt(e.target.value))}
                        onBlur={() => {
                          if (!classCount || classCount < 1) setClassCount(1);
                          if (classCount > 12) setClassCount(12);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">1~12 사이의 값을 입력하세요.</p>
                    </div>

                    {/* 회차 계산 결과 */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                      <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                        <Calculator className="w-4 h-4" />
                        계산 결과
                      </div>
                      <div className="text-blue-600 dark:text-blue-500">
                        {perClassFee.toLocaleString()}원 x {classCount}회
                      </div>
                      <div className="text-blue-700 dark:text-blue-400 font-medium mt-1">
                        총 크레딧: {countCalculation.totalCredit.toLocaleString()}원
                      </div>
                    </div>
                  </TabsContent>

                  {/* 금액 직접 입력 */}
                  <TabsContent value="amount" className="space-y-3 mt-3">
                    <div className="space-y-1">
                      <Label htmlFor="directAmount">크레딧 금액 (원)</Label>
                      <Input
                        id="directAmount"
                        type="number"
                        min={1000}
                        max={10000000}
                        step={1000}
                        value={directAmount || ''}
                        onChange={(e) => setDirectAmount(e.target.value === '' ? 0 : parseInt(e.target.value))}
                        placeholder="예: 50000"
                      />
                      <p className="text-xs text-muted-foreground">1,000원 ~ 10,000,000원 (1,000원 단위 권장)</p>
                    </div>

                    {/* 금액 미리보기 */}
                    {directAmount > 0 && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                        <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                          <Banknote className="w-4 h-4" />
                          입력 금액
                        </div>
                        <div className="text-blue-700 dark:text-blue-400 font-medium">
                          크레딧: {directAmount.toLocaleString()}원
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* 사유 선택 */}
                <div className="space-y-2">
                  <Label>사유</Label>
                  <div className="flex flex-wrap gap-2">
                    {REASON_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={reason === preset.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setReason(preset.value)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  {reason === '기타' && (
                    <Input
                      placeholder="사유를 직접 입력하세요"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                {/* 메모 */}
                <div className="space-y-1">
                  <Label htmlFor="notes">추가 메모 (선택)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="추가 설명이 필요한 경우 입력하세요"
                    rows={2}
                  />
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={processing || currentCalculation.totalCredit <= 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {processing ? '생성 중...' : `${currentCalculation.totalCredit?.toLocaleString() || 0}원 크레딧 생성`}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* 크레딧 목록 */}
          <TabsContent value="manage">
            <div className="py-6 px-6 space-y-3">
              {loadingCredits ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : credits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  등록된 크레딧이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {credits.map((credit) => (
                    <div
                      key={credit.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      {editingCredit?.id === credit.id ? (
                        // 수정 모드
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label>금액</Label>
                            <Input
                              type="number"
                              value={editAmount || ''}
                              onChange={(e) => setEditAmount(e.target.value === '' ? 0 : parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>메모</Label>
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={2}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCredit(null)}
                            >
                              취소
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={processing}
                            >
                              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // 보기 모드
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-lg">
                                {credit.credit_amount.toLocaleString()}원
                              </span>
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted">
                                {CREDIT_TYPE_LABELS[credit.credit_type] || credit.credit_type}
                              </span>
                              <span className={`ml-1 text-xs px-2 py-0.5 rounded ${
                                credit.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                credit.status === 'used' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {CREDIT_STATUS_LABELS[credit.status] || credit.status}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {(credit.status === 'pending' || credit.status === 'partial') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => openApplyModal(credit)}
                                >
                                  적용
                                </Button>
                              )}
                              {credit.status !== 'used' && credit.status !== 'applied' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(credit)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDelete(credit.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {credit.rest_start_date && (
                              <div>
                                기간: {format(new Date(credit.rest_start_date), 'M/d', { locale: ko })} ~ {format(new Date(credit.rest_end_date), 'M/d', { locale: ko })}
                                {credit.rest_days > 0 && ` (${credit.rest_days}회)`}
                              </div>
                            )}
                            {credit.notes && (
                              <div className="mt-1 text-xs">{credit.notes}</div>
                            )}
                            <div className="text-xs mt-1">
                              생성: {format(new Date(credit.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                닫기
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* 적용 모달 */}
    <Dialog open={!!applyingCredit} onOpenChange={(open) => !open && setApplyingCredit(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>크레딧 적용</DialogTitle>
          <DialogDescription>
            크레딧을 적용할 월을 선택하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 px-6 space-y-4">
          {applyingCredit && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted">
                  {CREDIT_TYPE_LABELS[applyingCredit.credit_type] || applyingCredit.credit_type}
                </span>
                <span className="text-sm font-medium">
                  {applyingCredit.remaining_amount.toLocaleString()}원
                </span>
              </div>
              {applyingCredit.notes && (
                <div className="text-xs text-muted-foreground">
                  {applyingCredit.notes}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="applyYearMonth">적용할 월</Label>
            <Input
              id="applyYearMonth"
              type="month"
              value={applyYearMonth}
              onChange={(e) => setApplyYearMonth(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              해당 월 학원비에서 크레딧 금액만큼 차감됩니다.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setApplyingCredit(null)}
            disabled={applying}
          >
            취소
          </Button>
          <Button
            onClick={handleApplyCredit}
            disabled={applying || !applyYearMonth}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {applying ? '적용 중...' : '적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
