'use client';

/**
 * Pending Student List Component
 * 미등록관리 학생 목록 컴포넌트
 * - 상담 완료 후 체험 수업 미예약 학생
 * - 체험 수업 완료 후 미등록 학생
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, UserPlus, Trash2, Clock, MessageSquare, Sparkles, FileText, Check, X, Pencil, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Student } from '@/lib/types/student';
import apiClient from '@/lib/api/client';

interface PendingStudentListProps {
  students: Student[];
  loading: boolean;
  onReload: () => void;
}

interface ConsultationInfo {
  id: number;
}

interface TrialDate {
  date: string;
  attended: boolean;
  time_slot: string;
}

export function PendingStudentList({ students, loading, onReload }: PendingStudentListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingConsultationId, setLoadingConsultationId] = useState<number | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoValue, setMemoValue] = useState('');
  const [savingMemoId, setSavingMemoId] = useState<number | null>(null);

  // 메모 편집 시작
  const handleEditMemo = (student: Student) => {
    setEditingMemoId(student.id);
    setMemoValue(student.memo || '');
  };

  // 메모 저장
  const handleSaveMemo = async (studentId: number) => {
    try {
      setSavingMemoId(studentId);
      await apiClient.put(`/students/${studentId}`, { memo: memoValue });
      toast.success('메모가 저장되었습니다.');
      setEditingMemoId(null);
      onReload();
    } catch (error) {
      console.error('Failed to save memo:', error);
      toast.error('메모 저장에 실패했습니다.');
    } finally {
      setSavingMemoId(null);
    }
  };

  // 메모 편집 취소
  const handleCancelMemo = () => {
    setEditingMemoId(null);
    setMemoValue('');
  };

  // 상담 정보 조회 - 상담 진행 페이지로 이동
  const handleViewConsultation = async (student: Student) => {
    setLoadingConsultationId(student.id);
    try {
      const res = await apiClient.get<{ consultation: ConsultationInfo }>(`/consultations/by-student/${student.id}`);
      if (res.consultation?.id) {
        // 상담 진행 페이지로 이동 (돌아올 곳 기억)
        router.push(`/consultations/${res.consultation.id}/conduct?from=pending`);
      } else {
        toast.error('상담 정보를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to load consultation:', error);
      toast.error('상담 정보를 찾을 수 없습니다.');
    } finally {
      setLoadingConsultationId(null);
    }
  };

  // 정식 등록 처리 (active 상태로 변경)
  const handleRegister = (student: Student) => {
    // 학생 정보를 쿼리 파라미터로 전달
    const params = new URLSearchParams({
      from_pending: student.id.toString(),
      name: student.name,
      phone: student.phone || '',
      parent_phone: student.parent_phone || '',
      student_type: student.student_type || 'exam',
      grade: student.grade || '',
      school: student.school || '',
    });
    router.push(`/students/new?${params.toString()}`);
  };

  // 체험 등록 처리 (trial 상태로 변경)
  const handleTrialRegister = async (student: Student) => {
    try {
      // 기존 체험 일정에서 남은 횟수 계산
      const trialDates = parseTrialDates(student.trial_dates);
      const remainingCount = trialDates.length > 0
        ? trialDates.filter(t => !t.attended).length
        : 2; // 체험 일정이 없으면 기본 2회

      await apiClient.put(`/students/${student.id}`, {
        status: 'trial',
        is_trial: true,
        trial_remaining: remainingCount,
      });
      toast.success(`${student.name} 학생을 체험생으로 등록했습니다.`);
      onReload();
    } catch (error) {
      console.error('Failed to register as trial:', error);
      toast.error('체험생 등록에 실패했습니다.');
    }
  };

  // 삭제 처리
  const handleDelete = async (student: Student) => {
    if (!confirm(`${student.name} 학생을 삭제하시겠습니까?\n(모든 기록이 삭제됩니다)`)) {
      return;
    }

    try {
      setDeletingId(student.id);
      await apiClient.delete(`/students/${student.id}`);
      toast.success(`${student.name} 학생이 삭제되었습니다.`);
      onReload();
    } catch (error) {
      console.error('Failed to delete student:', error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // 상담일 포맷팅
  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 체험 날짜 파싱
  const parseTrialDates = (trialDates: Student['trial_dates']): TrialDate[] => {
    if (!trialDates) return [];
    if (typeof trialDates === 'string') {
      try {
        return JSON.parse(trialDates);
      } catch {
        return [];
      }
    }
    return trialDates as TrialDate[];
  };

  // 체험 날짜 포맷팅 (짧게)
  const formatTrialDate = (date: string) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground mt-2">로딩 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">미등록관리 학생이 없습니다</h3>
          <p className="text-muted-foreground">
            상담 완료 후 체험 미예약 또는 체험 완료 학생이 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">이름</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">학년</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">연락처</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">학부모 연락처</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">상담일</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">체험 일정</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">메모</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-muted">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                      <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="font-medium text-foreground">{student.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {student.grade || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {student.phone || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {student.parent_phone || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {formatDate(student.consultation_date || student.created_at)}
                </td>
                <td className="py-3 px-4">
                  {(() => {
                    const trialDates = parseTrialDates(student.trial_dates);
                    if (trialDates.length === 0) {
                      return <span className="text-sm text-muted-foreground">-</span>;
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        {trialDates.map((trial, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className={`text-xs flex items-center gap-1 ${
                              trial.attended
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
                                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700'
                            }`}
                          >
                            {formatTrialDate(trial.date)}
                            {trial.attended ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3 opacity-50" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4">
                  {editingMemoId === student.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={memoValue}
                        onChange={(e) => setMemoValue(e.target.value)}
                        className="h-7 text-sm"
                        placeholder="메모 입력..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveMemo(student.id);
                          if (e.key === 'Escape') handleCancelMemo();
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleSaveMemo(student.id)}
                        disabled={savingMemoId === student.id}
                      >
                        {savingMemoId === student.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={handleCancelMemo}
                      >
                        <X className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span
                        className="text-sm text-muted-foreground line-clamp-1 flex-1 cursor-pointer hover:text-foreground"
                        title={student.memo || '클릭하여 메모 추가'}
                        onClick={() => handleEditMemo(student)}
                      >
                        {student.memo || '-'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleEditMemo(student)}
                        title="메모 편집"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewConsultation(student)}
                      title="상담 정보 보기"
                      disabled={loadingConsultationId === student.id}
                    >
                      {loadingConsultationId === student.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrialRegister(student)}
                      title="체험생으로 등록"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      체험 등록
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRegister(student)}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      정식 등록
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                      onClick={() => handleDelete(student)}
                      disabled={deletingId === student.id}
                    >
                      {deletingId === student.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
