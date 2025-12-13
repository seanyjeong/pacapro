'use client';

/**
 * 출석 체크 컴포넌트
 * - 보충(makeup) 상태 지원: 날짜 선택 가능
 * - 보충으로 온 학생은 "(보충)" 표시
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Save, UserCheck, Calendar, UserPlus, Search, X, HelpCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// 공결 사유 옵션
const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
];

// 결석 사유 옵션
const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
  { value: '기타', label: '기타' },
];
import {
  getAttendanceStatusLabel,
  getAttendanceStatusColor,
  calculateAttendanceStats,
} from '@/lib/utils/schedule-helpers';
import type { Attendance, AttendanceStatus, AttendanceSubmission } from '@/lib/types/schedule';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/types/schedule';

interface AttendanceCheckerProps {
  attendances: Attendance[];
  onSubmit: (submissions: AttendanceSubmission[]) => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  currentDate?: string; // 현재 출석 체크 중인 날짜 (보충 날짜 선택 시 최소 날짜로 사용)
  scheduleId?: number; // 스케줄 ID (보충 학생 추가 시 필요)
  timeSlot?: string; // 시간대 (보충 학생 추가 시 필요)
  onStudentAdded?: () => void; // 학생 추가 후 콜백
}

export function AttendanceChecker({
  attendances,
  onSubmit,
  isSubmitting,
  readOnly = false,
  currentDate,
  scheduleId,
  timeSlot,
  onStudentAdded,
}: AttendanceCheckerProps) {
  // 출석 편집 데이터 타입
  type EditedAttendanceData = { status: AttendanceStatus | null; makeup_date?: string; notes?: string };

  // 보충 학생 추가 모달 상태
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; grade: string; student_number: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // 결석/공결 사유 모달 상태
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalData, setReasonModalData] = useState<{
    studentId: number;
    studentName: string;
    status: 'absent' | 'excused';
    reason: string;
    customReason: string;
  } | null>(null);

  const [editedAttendances, setEditedAttendances] = useState<Map<number, EditedAttendanceData>>(
    new Map(
      attendances.map((a) => [
        a.student_id,
        { status: a.attendance_status, makeup_date: a.makeup_date, notes: a.notes },
      ])
    )
  );

  const stats = calculateAttendanceStats(
    attendances.map((a) => ({
      ...a,
      attendance_status:
        editedAttendances.get(a.student_id)?.status || a.attendance_status,
    }))
  );

  const handleStatusChange = (studentId: number, status: AttendanceStatus | null, studentName?: string) => {
    // 현재 상태 확인
    const current = editedAttendances.get(studentId);
    const currentStatus = current?.status || null;

    // 같은 상태를 다시 선택하면 토글 (해제)
    if (status !== null && status === currentStatus) {
      setEditedAttendances((prev) => {
        const newMap = new Map(prev);
        newMap.set(studentId, { status: null, makeup_date: undefined, notes: undefined });
        return newMap;
      });
      return;
    }

    // 결석 또는 공결 선택 시 사유 모달 표시
    if ((status === 'absent' || status === 'excused') && studentName) {
      setReasonModalData({
        studentId,
        studentName,
        status,
        reason: '',
        customReason: '',
      });
      setShowReasonModal(true);
      return;
    }

    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: null };
      // 보충이 아닌 다른 상태로 변경되면 makeup_date 초기화
      const newData: EditedAttendanceData = { ...current, status };
      if (status !== 'makeup') {
        newData.makeup_date = undefined;
      }
      // 결석/공결이 아닌 상태로 변경되면 notes 초기화
      if (status !== 'absent' && status !== 'excused') {
        newData.notes = undefined;
      }
      newMap.set(studentId, newData);
      return newMap;
    });
  };

  // 사유 모달 확인 핸들러
  const handleReasonConfirm = () => {
    if (!reasonModalData) return;

    const { studentId, status, reason, customReason } = reasonModalData;
    const finalNotes = reason === '기타' ? customReason : reason;

    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: null };
      newMap.set(studentId, {
        ...current,
        status,
        notes: finalNotes,
        makeup_date: undefined,
      });
      return newMap;
    });

    setShowReasonModal(false);
    setReasonModalData(null);
  };

  // 사유 모달 취소 핸들러
  const handleReasonCancel = () => {
    setShowReasonModal(false);
    setReasonModalData(null);
  };

  const handleMakeupDateChange = (studentId: number, makeupDate: string) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: 'makeup' };
      newMap.set(studentId, { ...current, makeup_date: makeupDate });
      return newMap;
    });
  };

  const handleNotesChange = (studentId: number, notes: string) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: null };
      newMap.set(studentId, { ...current, notes });
      return newMap;
    });
  };

  const handleSubmit = () => {
    const submissions: AttendanceSubmission[] = [];

    let hasError = false;
    editedAttendances.forEach((data, studentId) => {
      const original = attendances.find((a) => a.student_id === studentId);

      if (data.status) {
        // 보충 상태인데 날짜가 없으면 경고
        if (data.status === 'makeup' && !data.makeup_date) {
          toast.error('보충으로 설정된 학생의 보충 날짜를 선택해주세요.');
          hasError = true;
          return;
        }
        submissions.push({
          student_id: studentId,
          attendance_status: data.status,
          makeup_date: data.makeup_date,
          notes: data.notes,
        });
      } else if (original?.attendance_status) {
        // 원래 출석 기록이 있었는데 해제된 경우 → 삭제 요청
        submissions.push({
          student_id: studentId,
          attendance_status: 'none' as AttendanceStatus,
        });
      }
    });
    if (hasError) return;

    onSubmit(submissions);
  };

  const hasChanges = Array.from(editedAttendances.entries()).some(([studentId, data]) => {
    const original = attendances.find((a) => a.student_id === studentId);
    return (
      data.status !== original?.attendance_status ||
      data.makeup_date !== original?.makeup_date ||
      data.notes !== original?.notes
    );
  });

  // 학생 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://supermax.kr/paca'}/students?search=${encodeURIComponent(searchQuery)}&status=active&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      // 이미 출석 명단에 있는 학생 제외
      const existingIds = new Set(attendances.map(a => a.student_id));
      const filtered = (data.students || []).filter((s: { id: number }) => !existingIds.has(s.id));
      setSearchResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('학생 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 보충 학생 추가
  const handleAddMakeupStudent = async (studentId: number, studentName: string) => {
    if (!currentDate || !timeSlot) {
      toast.error('수업 정보가 없습니다.');
      return;
    }

    setIsAddingStudent(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://supermax.kr/paca'}/schedules/slot/student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          date: currentDate,
          time_slot: timeSlot,
          student_id: studentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '학생 추가 실패');
      }

      toast.success(`${studentName} 학생이 보충으로 추가되었습니다.`);
      setShowAddStudentModal(false);
      setSearchQuery('');
      setSearchResults([]);

      // 부모 컴포넌트에서 데이터 새로고침
      if (onStudentAdded) {
        onStudentAdded();
      }
    } catch (error: any) {
      toast.error(error.message || '학생 추가에 실패했습니다.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            출석 통계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">전체</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-sm text-muted-foreground">출석</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-muted-foreground">결석</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
              <p className="text-sm text-muted-foreground">지각</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.excused}</p>
              <p className="text-sm text-muted-foreground">공결</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.makeup}</p>
              <p className="text-sm text-muted-foreground">보충</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <p className="text-lg font-semibold">
              출석률: {stats.presentRate}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 출석 체크 리스트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>학생 출석 체크</CardTitle>
            <div className="flex gap-2">
              {!readOnly && currentDate && timeSlot && (
                <Button
                  variant="outline"
                  onClick={() => setShowAddStudentModal(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  보충 학생 추가
                </Button>
              )}
              {!readOnly && attendances.length > 0 && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !hasChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? '저장 중...' : '저장'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attendances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>이 수업에 등록된 학생이 없습니다.</p>
              <p className="text-sm mt-1">학생을 먼저 등록해주세요.</p>
            </div>
          ) : (
          <div className="space-y-4">
            {attendances.map((attendance) => {
              const edited = editedAttendances.get(attendance.student_id);
              const currentStatus = edited?.status || attendance.attendance_status;
              const currentMakeupDate = edited?.makeup_date || attendance.makeup_date || '';
              const currentNotes = edited?.notes || attendance.notes || '';
              const isFromMakeup = attendance.is_makeup; // 다른 날짜에서 보충으로 온 학생

              return (
                <div
                  key={attendance.student_id}
                  className={cn(
                    "p-4 border rounded-lg space-y-3",
                    isFromMakeup && "bg-purple-50 border-purple-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {isFromMakeup && (
                          <Badge variant="outline" className="mr-2 bg-purple-100 text-purple-700 border-purple-300">
                            보충
                          </Badge>
                        )}
                        {attendance.student_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        학번: {attendance.student_number}
                        {isFromMakeup && attendance.original_date && (
                          <span className="ml-2 text-purple-600">
                            (원래 날짜: {attendance.original_date})
                          </span>
                        )}
                      </p>
                    </div>
                    {currentStatus && (
                      <Badge
                        variant="outline"
                        className={cn(getAttendanceStatusColor(currentStatus))}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {getAttendanceStatusLabel(currentStatus)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* 출석 상태 선택 */}
                    <div className="space-y-2">
                      <Select
                        value={currentStatus || 'none'}
                        onValueChange={(value) =>
                          handleStatusChange(
                            attendance.student_id,
                            value === 'none' ? null : (value as AttendanceStatus),
                            attendance.student_name
                          )
                        }
                        disabled={readOnly || isFromMakeup}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="출석 상태를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">미체크</SelectItem>
                          <SelectItem value="present">
                            {ATTENDANCE_STATUS_LABELS.present}
                          </SelectItem>
                          <SelectItem value="absent">
                            {ATTENDANCE_STATUS_LABELS.absent}
                          </SelectItem>
                          <SelectItem value="late">
                            {ATTENDANCE_STATUS_LABELS.late}
                          </SelectItem>
                          <SelectItem value="excused">
                            <span className="flex items-center gap-1">
                              {ATTENDANCE_STATUS_LABELS.excused}
                              <span className="text-xs text-muted-foreground">(공식적 결석)</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="makeup">
                            {ATTENDANCE_STATUS_LABELS.makeup}
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* 보충 날짜 선택 (보충 상태일 때만 표시) */}
                      {currentStatus === 'makeup' && !isFromMakeup && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <Input
                            type="date"
                            value={currentMakeupDate}
                            onChange={(e) => handleMakeupDateChange(attendance.student_id, e.target.value)}
                            min={currentDate || new Date().toISOString().split('T')[0]}
                            className="flex-1 text-sm"
                            placeholder="보충 날짜"
                            disabled={readOnly}
                          />
                        </div>
                      )}
                    </div>

                    {/* 메모 / 사유 표시 */}
                    <div className="space-y-2">
                      {/* 결석/공결 사유 표시 */}
                      {(currentStatus === 'absent' || currentStatus === 'excused') && currentNotes && (
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                          currentStatus === 'excused'
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>사유: {currentNotes}</span>
                        </div>
                      )}
                      {/* 일반 메모 (결석/공결이 아닐 때) */}
                      {currentStatus !== 'absent' && currentStatus !== 'excused' && (
                        <Textarea
                          value={currentNotes}
                          onChange={(e) =>
                            handleNotesChange(attendance.student_id, e.target.value)
                          }
                          placeholder="메모 (선택사항)"
                          rows={1}
                          disabled={readOnly}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* 보충 학생 추가 모달 */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">보충 학생 추가</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddStudentModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="학생 이름 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? '검색 중...' : '검색'}
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? '검색 결과가 없습니다.' : '학생 이름을 검색하세요.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.grade} · {student.student_number}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMakeupStudent(student.id, student.name)}
                          disabled={isAddingStudent}
                        >
                          {isAddingStudent ? '추가 중...' : '추가'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 결석/공결 사유 입력 모달 */}
      {showReasonModal && reasonModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {reasonModalData.status === 'excused' ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    공결 사유 입력
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    결석 사유 입력
                  </>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReasonCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 본문 */}
            <div className="p-4 space-y-4">
              {/* 학생 정보 */}
              <div className="text-center py-2">
                <p className="font-medium text-lg">{reasonModalData.studentName}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1",
                    reasonModalData.status === 'excused'
                      ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {reasonModalData.status === 'excused' ? '공결' : '결석'}
                </Badge>
              </div>

              {/* 공결 설명 */}
              {reasonModalData.status === 'excused' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-semibold mb-1">공결이란?</p>
                      <p className="text-blue-700 dark:text-blue-400">
                        <strong>공식적 결석</strong>으로, 원장님의 승인이 필요합니다.
                      </p>
                      <p className="text-blue-600 dark:text-blue-500 mt-1">
                        승인되지 않은 결석은 <strong>일반 결석</strong>으로 처리됩니다.
                      </p>
                      <p className="text-blue-600 dark:text-blue-500 mt-1 text-xs">
                        ※ 공결은 출석으로 인정되지 않으며, 월말 정산 시 보충/5주차로 상쇄 후 남은 횟수에 대해 다음 달 학원비에서 차감됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 결석 설명 */}
              {reasonModalData.status === 'absent' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800 dark:text-red-300">
                      <p className="font-semibold mb-1">결석 안내</p>
                      <p className="text-red-700 dark:text-red-400">
                        일반 결석은 <strong>학생 본인 책임</strong>이며, 별도의 보상이 없습니다.
                      </p>
                      <p className="text-red-600 dark:text-red-500 mt-1 text-xs">
                        ※ 공식적 사유가 있는 경우 &apos;공결&apos;로 선택해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 사유 선택 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">사유 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {(reasonModalData.status === 'excused' ? EXCUSED_REASONS : ABSENT_REASONS).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReasonModalData({ ...reasonModalData, reason: option.value, customReason: '' })}
                      className={cn(
                        "p-3 border rounded-lg text-sm font-medium transition-all",
                        reasonModalData.reason === option.value
                          ? reasonModalData.status === 'excused'
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                  {/* 기타 옵션 */}
                  <button
                    type="button"
                    onClick={() => setReasonModalData({ ...reasonModalData, reason: '기타', customReason: '' })}
                    className={cn(
                      "p-3 border rounded-lg text-sm font-medium transition-all col-span-2",
                      reasonModalData.reason === '기타'
                        ? reasonModalData.status === 'excused'
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    기타 (직접 입력)
                  </button>
                </div>
              </div>

              {/* 기타 사유 입력 */}
              {reasonModalData.reason === '기타' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">사유 입력</label>
                  <Textarea
                    value={reasonModalData.customReason}
                    onChange={(e) => setReasonModalData({ ...reasonModalData, customReason: e.target.value })}
                    placeholder="사유를 입력하세요..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="flex gap-2 p-4 border-t dark:border-gray-700">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReasonCancel}
              >
                취소
              </Button>
              <Button
                className={cn(
                  "flex-1",
                  reasonModalData.status === 'excused'
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
                onClick={handleReasonConfirm}
                disabled={!reasonModalData.reason || (reasonModalData.reason === '기타' && !reasonModalData.customReason.trim())}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
