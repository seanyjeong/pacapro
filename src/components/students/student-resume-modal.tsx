'use client';

import { useState } from 'react';
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
import { Calendar, User, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { toast } from 'sonner';

// 휴원 종료 대기 학생 타입
export interface RestEndedStudent {
  id: number;
  name: string;
  phone: string | null;
  school: string | null;
  grade: string | null;
  rest_start_date: string;
  rest_end_date: string;
  rest_reason: string | null;
  class_days: number[] | string;
  time_slot: string | null;
  monthly_tuition: string;
  discount_rate: string;
  days_overdue: number;
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
    } catch (err: any) {
      setError(err.response?.data?.message || '복귀 처리 중 오류가 발생했습니다.');
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
                휴원 기간: {student.rest_start_date} ~ {student.rest_end_date}
              </div>
              {student.rest_reason && (
                <div className="text-sm text-muted-foreground">
                  사유: {student.rest_reason}
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                <Clock className="w-4 h-4" />
                종료일로부터 {student.days_overdue}일 경과
              </div>
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
              <p className="text-xs text-muted-foreground">
                선택한 날짜부터 스케줄이 재배정되고, 해당 월 학원비가 일할계산됩니다.
              </p>
            </div>

            {/* 예상 처리 내용 */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm">
              <div className="font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                복귀 시 처리 내용
              </div>
              <ul className="text-emerald-600 dark:text-emerald-500 space-y-1 text-xs">
                <li>- 상태가 &apos;재원&apos;으로 변경됩니다</li>
                <li>- 수업 요일({formatClassDays(student.class_days)})에 맞춰 스케줄이 재배정됩니다</li>
                <li>- 해당 월 학원비가 일할계산으로 자동 생성됩니다</li>
              </ul>
            </div>

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
