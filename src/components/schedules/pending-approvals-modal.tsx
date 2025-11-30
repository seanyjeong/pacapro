'use client';

/**
 * 승인 대기 목록 모달
 * - 미배정 출근 요청 목록 표시
 * - 승인/거부 처리
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Check,
  X,
  Calendar,
  Clock,
  User,
  Sun,
  Sunrise,
  Moon,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { instructorsAPI, OvertimeApproval } from '@/lib/api/instructors';
import { toast } from 'sonner';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: typeof Sun; color: string; bgColor: string }> = {
  morning: { label: '오전', icon: Sunrise, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  afternoon: { label: '오후', icon: Sun, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  evening: { label: '저녁', icon: Moon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

interface PendingApprovalsModalProps {
  open: boolean;
  onClose: () => void;
  onApproved?: () => void;
}

export function PendingApprovalsModal({
  open,
  onClose,
  onApproved,
}: PendingApprovalsModalProps) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<OvertimeApproval[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      loadPendingRequests();
    }
  }, [open]);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await instructorsAPI.getPendingOvertimes();
      setRequests(response.requests || []);
    } catch (err) {
      console.error('Failed to load pending requests:', err);
      toast.error('요청 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: OvertimeApproval) => {
    try {
      setProcessingId(request.id);
      await instructorsAPI.approveOvertime(request.id, { status: 'approved' });
      toast.success(`${request.instructor_name}님의 출근 요청이 승인되었습니다.`);
      setRequests(prev => prev.filter(r => r.id !== request.id));
      onApproved?.();
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error('승인 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: OvertimeApproval) => {
    try {
      setProcessingId(request.id);
      await instructorsAPI.approveOvertime(request.id, { status: 'rejected' });
      toast.success(`${request.instructor_name}님의 출근 요청이 거부되었습니다.`);
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Failed to reject:', err);
      toast.error('거부 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${date.getMonth() + 1}/${date.getDate()} (${dayOfWeek})`;
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5); // HH:MM
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              승인 대기 중인 요청
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription>
            미배정 출근 요청을 승인하거나 거부할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p>대기 중인 요청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const slotInfo = request.time_slot ? TIME_SLOT_INFO[request.time_slot] : null;
                const SlotIcon = slotInfo?.icon || Calendar;
                const isProcessing = processingId === request.id;

                return (
                  <div
                    key={request.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* 강사 정보 */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">
                              {request.instructor_name}
                            </span>
                            {request.salary_type === 'hourly' && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                시급제
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* 날짜 및 시간대 */}
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(request.work_date)}
                          </div>
                          {slotInfo && (
                            <div className={cn('flex items-center gap-1', slotInfo.color)}>
                              <SlotIcon className="w-4 h-4" />
                              {slotInfo.label}
                            </div>
                          )}
                        </div>

                        {/* 시급제: 시간 정보 */}
                        {request.salary_type === 'hourly' && (request.original_end_time || request.actual_end_time) && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                            <Clock className="w-4 h-4" />
                            {formatTime(request.original_end_time)} ~ {formatTime(request.actual_end_time)}
                          </div>
                        )}

                        {/* 사유 */}
                        {request.notes && (
                          <p className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
                            {request.notes}
                          </p>
                        )}

                        {/* 요청일 */}
                        <p className="mt-2 text-xs text-gray-400">
                          요청일: {new Date(request.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>

                      {/* 승인/거부 버튼 */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              승인
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={isProcessing}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <X className="w-4 h-4 mr-1" />
                              거부
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
