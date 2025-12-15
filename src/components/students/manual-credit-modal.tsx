'use client';

import { useState, useMemo } from 'react';
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
import { CreditCard, Calendar, Hash, AlertTriangle, Calculator } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { toast } from 'sonner';

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
  // 입력 모드: 'date' | 'count'
  const [inputMode, setInputMode] = useState<'date' | 'count'>('date');

  // 날짜 입력
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 회차 입력
  const [classCount, setClassCount] = useState<number>(1);

  // 공통
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

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

  // 현재 모드의 계산 결과
  const currentCalculation = inputMode === 'date' ? dateCalculation : countCalculation;

  // 최종 사유
  const finalReason = reason === '기타' ? customReason : reason;

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
    } else {
      if (classCount < 1 || classCount > 12) {
        setError('회차는 1~12 사이로 입력해주세요.');
        return;
      }
    }

    try {
      setProcessing(true);
      setError('');

      const data = inputMode === 'date'
        ? { start_date: startDate, end_date: endDate, reason: finalReason, notes: notes || undefined }
        : { class_count: classCount, reason: finalReason, notes: notes || undefined };

      const result = await studentsAPI.createManualCredit(studentId, data);

      toast.success('크레딧 생성 완료', {
        description: result.message,
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '크레딧 생성 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setInputMode('date');
    setStartDate('');
    setEndDate('');
    setClassCount(1);
    setReason('');
    setCustomReason('');
    setNotes('');
    setError('');
    onClose();
  };

  // 수업 요일 표시
  const classDaysText = classDays.length > 0
    ? classDays.map(d => DAY_NAMES[d]).join(', ')
    : '미설정';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            수동 크레딧 생성
          </DialogTitle>
          <DialogDescription>
            {studentName} 학생에게 크레딧을 수동으로 생성합니다.
          </DialogDescription>
        </DialogHeader>

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
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'date' | 'count')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="date" className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  날짜로 입력
                </TabsTrigger>
                <TabsTrigger value="count" className="flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  회차로 입력
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
                    value={classCount}
                    onChange={(e) => setClassCount(parseInt(e.target.value) || 1)}
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
              disabled={processing || currentCalculation.count === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processing ? '생성 중...' : `${currentCalculation.totalCredit?.toLocaleString() || 0}원 크레딧 생성`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
