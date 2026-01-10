'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canView } from '@/lib/utils/permissions';
import { getConsultations } from '@/lib/api/consultations';
import { ArrowLeft, MessageSquare, Clock, User, Phone, School, GraduationCap, X } from 'lucide-react';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';

export default function MobileConsultationsPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!canView('consultations')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
  }, [router]);

  useEffect(() => {
    if (hasPermission) {
      loadTodayConsultations();
    }
  }, [hasPermission]);

  const loadTodayConsultations = async () => {
    setLoading(true);
    try {
      // 로컬 시간 기준으로 오늘 날짜 생성 (UTC 문제 방지)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const response = await getConsultations({
        startDate: today,
        endDate: today,
      });
      // 시간순 정렬
      const sorted = (response.consultations || []).sort((a, b) => {
        const timeA = a.preferred_time || '00:00';
        const timeB = b.preferred_time || '00:00';
        return timeA.localeCompare(timeB);
      });
      setConsultations(sorted);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  // 시간 포맷 (HH:MM -> 오전/오후 형식)
  const formatTime = (time: string | null | undefined) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
  };

  // 학년 표시
  const formatGrade = (grade: string | null | undefined) => {
    if (!grade) return '';
    const gradeNum = parseInt(grade);
    if (gradeNum >= 1 && gradeNum <= 3) return `고${gradeNum}`;
    if (grade === 'N') return 'N수생';
    return grade;
  };

  // 끝난 상담 여부 (완료/취소/노쇼)
  const isFinished = (status: ConsultationStatus) => {
    return ['completed', 'cancelled', 'no_show'].includes(status);
  };

  // 상태별 라벨
  const getStatusLabel = (status: ConsultationStatus) => {
    const labels: Record<ConsultationStatus, string> = {
      pending: '대기',
      confirmed: '확정',
      completed: '완료',
      cancelled: '취소',
      no_show: '노쇼',
    };
    return labels[status];
  };

  // 상태별 색상
  const getStatusColor = (status: ConsultationStatus) => {
    const colors: Record<ConsultationStatus, string> = {
      pending: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
      confirmed: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
      completed: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
      cancelled: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
      no_show: 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    };
    return colors[status];
  };

  if (hasPermission === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* 헤더 */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">오늘 상담</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </div>
      </header>

      {/* 상담 목록 */}
      <main className="p-4 pb-8">
        {consultations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">오늘 예정된 상담이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 요약 */}
            <div className="bg-card rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">오늘 상담</p>
                  <div className="flex items-baseline gap-2">
                    <p className="font-bold text-2xl text-green-600 dark:text-green-400">
                      {consultations.filter(c => !isFinished(c.status)).length}건
                    </p>
                    {consultations.filter(c => isFinished(c.status)).length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        (완료 {consultations.filter(c => isFinished(c.status)).length}건)
                      </p>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* 상담 카드 목록 */}
            <div className="space-y-3">
              {consultations.map((consultation) => {
                const finished = isFinished(consultation.status);
                return (
                  <button
                    key={consultation.id}
                    onClick={() => setSelectedConsultation(consultation)}
                    className={`w-full bg-card rounded-xl p-4 shadow-sm text-left transition-all
                                active:scale-[0.98] hover:bg-muted dark:hover:bg-secondary/50
                                ${finished ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${finished ? 'bg-gray-100 dark:bg-gray-800' : 'bg-green-50 dark:bg-green-900/30'}`}>
                        <User className={`h-5 w-5 ${finished ? 'text-gray-400 dark:text-gray-500' : 'text-green-600 dark:text-green-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold text-lg truncate ${finished ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {consultation.student_name}
                          </p>
                          {finished && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(consultation.status)}`}>
                              {getStatusLabel(consultation.status)}
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${finished ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className={`font-medium ${finished ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {formatTime(consultation.preferred_time)}
                          </span>
                          {consultation.student_grade && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span className={finished ? 'line-through' : ''}>{formatGrade(consultation.student_grade)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* 상담 상세 모달 */}
      {selectedConsultation && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedConsultation(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">상담 정보</h3>
              <button onClick={() => setSelectedConsultation(null)} className="p-2 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 이름 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이름</p>
                  <p className="font-semibold text-lg text-foreground">{selectedConsultation.student_name}</p>
                </div>
              </div>

              {/* 상담 시간 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">상담 시간</p>
                  <p className="font-semibold text-foreground">{formatTime(selectedConsultation.preferred_time)}</p>
                </div>
              </div>

              {/* 학생 전화번호 */}
              {selectedConsultation.student_phone && (
                <a href={`tel:${selectedConsultation.student_phone}`} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
                    <Phone className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">학생 전화번호</p>
                    <p className="font-semibold text-foreground">{selectedConsultation.student_phone}</p>
                  </div>
                </a>
              )}

              {/* 학교 */}
              {selectedConsultation.student_school && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/50 rounded-full flex items-center justify-center">
                    <School className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">학교</p>
                    <p className="font-semibold text-foreground">{selectedConsultation.student_school}</p>
                  </div>
                </div>
              )}

              {/* 학년 */}
              {selectedConsultation.student_grade && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/50 rounded-full flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">학년</p>
                    <p className="font-semibold text-foreground">{formatGrade(selectedConsultation.student_grade)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
