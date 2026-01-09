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
import { Calendar, User, Clock, AlertTriangle, CheckCircle2, Banknote, CalendarDays } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { toast } from 'sonner';

// 휴원 학생 타입 (무기한 휴원 지원)
export interface RestEndedStudent {
  id: number;
  name: string;
  phone: string | null;
  school: string | null;
  grade: string | null;
  rest_start_date: string;
  rest_end_date: string | null;  // null이면 무기한 휴원
  rest_reason: string | null;
  class_days: number[] | string;
  time_slot: string | null;
  monthly_tuition: string;
  discount_rate: string;
  weekly_count?: number;  // 주 수업 횟수
  days_overdue?: number;  // 복귀 지연 일수 (optional)
}

interface StudentResumeModalProps {
  open: boolean;
  onClose: () => void;
  student: RestEndedStudent | null;
  onSuccess: () => void;
}

// 수업 요일 포맷
function formatClassDays(classDays: number[] | string | null): string {
  if (!classDays) return '미정';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 문자열인 경우 (한글 요일: "월,수,금")
  if (typeof classDays === 'string') {
    return classDays || '미정';
  }

  // 배열인 경우 (숫자: [1, 3, 5])
  if (Array.isArray(classDays) && classDays.length > 0) {
    return classDays.map(d => dayNames[d] || d).join(', ');
  }

  return '미정';
}

// class_days를 숫자 배열로 변환
function parseClassDays(classDays: number[] | string | null): number[] {
  if (!classDays) return [];

  if (Array.isArray(classDays)) return classDays;

  // 문자열인 경우 파싱 시도
  if (typeof classDays === 'string') {
    const dayMap: Record<string, number> = {
      '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
    };
    return classDays.split(',').map(d => dayMap[d.trim()]).filter(d => d !== undefined);
  }

  return [];
}

// 복귀일부터 월말까지 수업요일 카운트
function countClassDaysUntilMonthEnd(resumeDate: string, classDays: number[]): number {
  if (!resumeDate || classDays.length === 0) return 0;

  const start = new Date(resumeDate);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // 월말
  let count = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (classDays.includes(d.getDay())) count++;
  }
  return count;
}

// 금액 포맷
function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export function StudentResumeModal({
  open,
  onClose,
  student,
  onSuccess,
}: StudentResumeModalProps) {
  const [resumeDate, setResumeDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // 미리보기 계산
  const preview = useMemo(() => {
    if (!student || !resumeDate) return null;

    const classDaysArray = parseClassDays(student.class_days);
    const weeklyCount = student.weekly_count || classDaysArray.length || 2;
    const monthlyTuition = parseFloat(student.monthly_tuition) || 0;
    const discountRate = parseFloat(student.discount_rate) || 0;

    // 할인 적용된 월 학원비
    const discountedTuition = monthlyTuition * (1 - discountRate / 100);

    // 월 총 수업일 (주 횟수 × 4주)
    const monthlyTotal = weeklyCount * 4;

    // 복귀일~월말 수업 횟수
    const remainingDays = countClassDaysUntilMonthEnd(resumeDate, classDaysArray);

    // 일할계산 금액
    const proRatedAmount = monthlyTotal > 0
      ? Math.round(discountedTuition * (remainingDays / monthlyTotal))
      : 0;

    return {
      classDays: formatClassDays(student.class_days),
      weeklyCount,
      remainingDays,
      monthlyTotal,
      proRatedAmount,
      discountedTuition: Math.round(discountedTuition),
    };
  }, [student, resumeDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    try {
      setProcessing(true);
      setError('');

      const result = await studentsAPI.resumeStudent(student.id, resumeDate);

      toast.success('복귀 처리 완료', {
        description: result.message,
      });

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '복귀 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setResumeDate(new Date().toISOString().split('T')[0]);
    setError('');
    onClose();
  };

  if (!student) return null;

  const isIndefinite = !student.rest_end_date;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            휴원 복귀 처리
          </DialogTitle>
          <DialogDescription>
            {student.name} 학생의 복귀 날짜를 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-6 px-6 space-y-4">
            {/* 학생 정보 요약 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{student.name}</span>
                {student.grade && (
                  <span className="text-muted-foreground">({student.grade})</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                휴원 시작: {student.rest_start_date}
                {isIndefinite ? (
                  <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">(무기한)</span>
                ) : (
                  <span> ~ {student.rest_end_date}</span>
                )}
              </div>
              {student.rest_reason && (
                <div className="text-sm text-muted-foreground">
                  사유: {student.rest_reason}
                </div>
              )}
              {!isIndefinite && student.days_overdue !== undefined && student.days_overdue > 0 && (
                <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                  <Clock className="w-4 h-4" />
                  종료일로부터 {student.days_overdue}일 경과
                </div>
              )}
            </div>

            {/* 복귀 날짜 선택 */}
            <div className="space-y-2">
              <Label htmlFor="resumeDate">복귀 날짜</Label>
              <input
                id="resumeDate"
                type="date"
                value={resumeDate}
                onChange={(e) => setResumeDate(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* 예상 처리 내용 - 미리보기 */}
            {preview && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm space-y-3">
                <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  복귀 시 처리 내용
                </div>

                {/* 스케줄 정보 */}
                <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-500">
                  <CalendarDays className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>수업 요일: <span className="font-medium">{preview.classDays}</span> (주 {preview.weeklyCount}회)</div>
                    <div className="text-xs mt-0.5">
                      {new Date(resumeDate).toLocaleDateString('ko-KR', { month: 'long' })} 예상 수업: <span className="font-medium">{preview.remainingDays}회</span>
                    </div>
                  </div>
                </div>

                {/* 학원비 정보 */}
                <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-500">
                  <Banknote className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>예상 학원비 (일할계산)</div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(preview.proRatedAmount)}
                    </div>
                    <div className="text-xs text-emerald-500 dark:text-emerald-600">
                      월 {formatCurrency(preview.discountedTuition)} × {preview.remainingDays}회/{preview.monthlyTotal}회
                    </div>
                  </div>
                </div>
              </div>
            )}

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
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {processing ? '처리 중...' : '복귀 처리'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
