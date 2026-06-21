'use client';

/**
 * Trial Student List Component
 * 체험생 목록 컴포넌트
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, UserPlus, Trash2, Calendar, Sparkles, Pencil, Clock, Check, FileText } from 'lucide-react';
import type { Student, TrialDate } from '@/lib/types/student';
import apiClient from '@/lib/api/client';

interface TrialStudentListProps {
  students: Student[];
  loading: boolean;
  onReload: () => void;
}

export function TrialStudentList({ students, loading, onReload }: TrialStudentListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [movingToPendingId, setMovingToPendingId] = useState<number | null>(null);
  const [loadingConsultationId, setLoadingConsultationId] = useState<number | null>(null);

  // 체험 일정 파싱
  const parseTrialDates = (trialDates: TrialDate[] | string | null): TrialDate[] => {
    if (!trialDates) return [];
    if (typeof trialDates === 'string') {
      try {
        return JSON.parse(trialDates);
      } catch {
        return [];
      }
    }
    return trialDates;
  };

  // 시간대 라벨
  const getTimeSlotLabel = (slot: string) => {
    const labels: Record<string, string> = {
      morning: '오전',
      afternoon: '오후',
      evening: '저녁',
    };
    return labels[slot] || slot;
  };

  // 상담 정보 조회 - 상담 진행 페이지로 이동
  const handleViewConsultation = async (student: Student) => {
    setLoadingConsultationId(student.id);
    try {
      const res = await apiClient.get<{ consultation: { id: number } }>(`/consultations/by-student/${student.id}`);
      if (res.consultation?.id) {
        router.push(`/consultations/${res.consultation.id}/conduct?from=trial`);
      } else {
        toast.error('상담 정보를 찾을 수 없습니다.');
      }
    } catch {
      toast.error('상담 정보를 찾을 수 없습니다.');
    } finally {
      setLoadingConsultationId(null);
    }
  };

  // 정식 등록 처리
  const handleRegister = (student: Student) => {
    // 체험생 정보를 쿼리 파라미터로 전달
    const params = new URLSearchParams({
      from_trial: student.id.toString(),
      name: student.name,
      phone: student.phone || '',
      student_type: student.student_type,
      grade: student.grade || '',
    });
    router.push(`/students/new?${params.toString()}`);
  };

  // 체험 종료 처리 (미등록관리로 이동)
  const handleDelete = async (student: Student) => {
    if (!confirm(`${student.name} 학생의 체험을 종료하시겠습니까?\n(미등록관리로 이동됩니다)`)) {
      return;
    }

    try {
      setDeletingId(student.id);
      await apiClient.put(`/students/${student.id}`, {
        status: 'pending',
        is_trial: false
      });
      toast.success(`${student.name} 학생의 체험이 종료되어 미등록관리로 이동했습니다.`);
      onReload();
    } catch (error) {
      console.error('Failed to end trial:', error);
      toast.error('체험 종료에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // 미등록관리로 이동 처리
  const handleMoveToPending = async (student: Student) => {
    if (!confirm(`${student.name} 학생을 미등록관리로 이동하시겠습니까?`)) {
      return;
    }

    try {
      setMovingToPendingId(student.id);
      await apiClient.put(`/students/${student.id}`, {
        status: 'pending',
        is_trial: false
      });
      toast.success(`${student.name} 학생을 미등록관리로 이동했습니다.`);
      onReload();
    } catch (error) {
      console.error('Failed to move to pending:', error);
      toast.error('미등록관리로 이동에 실패했습니다.');
    } finally {
      setMovingToPendingId(null);
    }
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
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">체험생이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            체험 수업을 원하는 학생을 등록해보세요.
          </p>
          <Button onClick={() => router.push('/students/new?is_trial=true')}>
            <UserPlus className="w-4 h-4 mr-2" />
            체험생 등록
          </Button>
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
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">성별</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">학교</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">연락처</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">체험 일정</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-muted-foreground">남은 횟수</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {students.map((student) => {
              const trialDates = parseTrialDates(student.trial_dates);
              const remaining = student.trial_remaining ?? 0;
              const total = trialDates.length || 2; // 체험 일정 수 기준

              return (
                <tr key={student.id} className="hover:bg-muted">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="font-medium text-foreground">{student.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {student.grade || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {student.gender === 'male' ? '남' : student.gender === 'female' ? '여' : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {student.school || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {student.phone || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {trialDates.map((td, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`text-xs flex items-center gap-1 ${
                            td.attended
                              ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
                              : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {td.date} {getTimeSlotLabel(td.time_slot)}
                          {td.attended && <Check className="w-3 h-3" />}
                        </Badge>
                      ))}
                      {trialDates.length === 0 && (
                        <span className="text-muted-foreground text-sm">미정</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant={remaining === 0 ? 'destructive' : 'secondary'}
                      className="font-mono"
                    >
                      {remaining}/{total}
                    </Badge>
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
                        onClick={() => router.push(`/students/${student.id}/edit`)}
                        title="체험 일정 수정"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950"
                        onClick={() => handleMoveToPending(student)}
                        disabled={movingToPendingId === student.id}
                        title="미등록관리로 이동"
                      >
                        {movingToPendingId === student.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
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
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
