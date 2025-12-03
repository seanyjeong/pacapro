'use client';

/**
 * 미배정 출근 요청 모달
 * - 배정되지 않은 날짜/시간대에 강사 출근 요청
 * - 관리자 승인 후 출근 체크 가능
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, User, Calendar, Clock, Sun, Sunrise, Moon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { instructorsAPI, OvertimeApproval } from '@/lib/api/instructors';
import { toast } from 'sonner';

interface Instructor {
  id: number;
  name: string;
  salary_type: 'hourly' | 'per_class' | 'monthly' | 'mixed';
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOTS: { slot: TimeSlot; label: string; icon: typeof Sun; color: string; defaultStart: string; defaultEnd: string }[] = [
  { slot: 'morning', label: '오전', icon: Sunrise, color: 'text-orange-600', defaultStart: '09:00', defaultEnd: '12:00' },
  { slot: 'afternoon', label: '오후', icon: Sun, color: 'text-blue-600', defaultStart: '13:00', defaultEnd: '17:00' },
  { slot: 'evening', label: '저녁', icon: Moon, color: 'text-purple-600', defaultStart: '18:00', defaultEnd: '21:00' },
];

interface ExtraDayRequestModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtraDayRequestModal({
  open,
  date,
  onClose,
  onSuccess,
}: ExtraDayRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>('afternoon');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  const selectedInstructor = instructors.find(i => i.id === selectedInstructorId);
  const isHourly = selectedInstructor?.salary_type === 'hourly';

  useEffect(() => {
    if (open) {
      loadInstructors();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    // 시간대 변경 시 기본 시간 설정
    const slotInfo = TIME_SLOTS.find(s => s.slot === selectedTimeSlot);
    if (slotInfo && isHourly) {
      setStartTime(slotInfo.defaultStart);
      setEndTime(slotInfo.defaultEnd);
    }
  }, [selectedTimeSlot, isHourly]);

  const resetForm = () => {
    setSelectedInstructorId(null);
    setSelectedTimeSlot('afternoon');
    setStartTime('');
    setEndTime('');
    setNotes('');
    setError(null);
  };

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const response = await instructorsAPI.getInstructors({ status: 'active' });
      setInstructors(response.instructors || []);
    } catch (err) {
      console.error('Failed to load instructors:', err);
      setError('강사 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!date || !selectedInstructorId) {
      setError('강사를 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await instructorsAPI.requestExtraDay(selectedInstructorId, {
        work_date: date,
        time_slot: selectedTimeSlot,
        original_end_time: isHourly ? startTime : undefined,
        actual_end_time: isHourly ? endTime : undefined,
        notes: notes || undefined,
      });

      toast.success('출근 요청이 등록되었습니다. 관리자 승인을 기다려주세요.');
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      const message = err?.response?.data?.message || '요청 등록에 실패했습니다.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!date) return null;

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayOfWeek})`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            미배정 출근 요청
          </DialogTitle>
          <DialogDescription>{formattedDate}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-1">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* 강사 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강사 선택
                </label>
                <select
                  value={selectedInstructorId || ''}
                  onChange={(e) => setSelectedInstructorId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">강사를 선택하세요</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name}
                      {instructor.salary_type === 'hourly' && ' (시급제)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 시간대 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시간대
                </label>
                <div className="flex gap-2">
                  {TIME_SLOTS.map(({ slot, label, icon: Icon, color }) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                        selectedTimeSlot === slot
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', selectedTimeSlot === slot ? 'text-blue-600' : color)} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시급제 강사: 시간 입력 */}
              {isHourly && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    예정 근무 시간
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-28"
                    />
                    <span className="text-gray-400">~</span>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
              )}

              {/* 사유 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사유 (선택)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="출근 요청 사유를 입력하세요"
                  className="resize-none"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedInstructorId}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            요청하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
