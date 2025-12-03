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
import { CheckCircle, Save, UserCheck, Calendar, UserPlus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const handleStatusChange = (studentId: number, status: AttendanceStatus | null) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { status: null };
      // 보충이 아닌 다른 상태로 변경되면 makeup_date 초기화
      const newData: EditedAttendanceData = { ...current, status };
      if (status !== 'makeup') {
        newData.makeup_date = undefined;
      }
      newMap.set(studentId, newData);
      return newMap;
    });
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
                            value === 'none' ? null : (value as AttendanceStatus)
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
                            {ATTENDANCE_STATUS_LABELS.excused}
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

                    {/* 메모 */}
                    <div>
                      <Textarea
                        value={currentNotes}
                        onChange={(e) =>
                          handleNotesChange(attendance.student_id, e.target.value)
                        }
                        placeholder="메모 (선택사항)"
                        rows={1}
                        disabled={readOnly}
                      />
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
    </div>
  );
}
