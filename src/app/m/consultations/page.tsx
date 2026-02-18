'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { canView } from '@/lib/utils/permissions';
import { getConsultations } from '@/lib/api/consultations';
import { ArrowLeft, MessageSquare, Clock, User, Phone, School, GraduationCap, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';

// Helper: format YYYY-MM-DD from Date (local timezone)
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: get month's calendar grid (Mon-start)
function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday=0, Sunday=6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function MobileConsultationsPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calendarMonth, setCalendarMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [showCalendar, setShowCalendar] = useState(false);

  // Month consultation counts for dot indicators
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});

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

  // Load consultations for selected date
  useEffect(() => {
    if (hasPermission) {
      loadConsultations(selectedDate);
    }
  }, [hasPermission, selectedDate]);

  // Load month counts when calendar month changes or opens
  useEffect(() => {
    if (hasPermission && showCalendar) {
      loadMonthCounts(calendarMonth.year, calendarMonth.month);
    }
  }, [hasPermission, showCalendar, calendarMonth.year, calendarMonth.month]);

  const loadConsultations = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = toLocalDateStr(date);
      const response = await getConsultations({
        startDate: dateStr,
        endDate: dateStr,
      });
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

  const loadMonthCounts = async (year: number, month: number) => {
    try {
      const startDate = toLocalDateStr(new Date(year, month, 1));
      const endDate = toLocalDateStr(new Date(year, month + 1, 0));
      const response = await getConsultations({
        startDate,
        endDate,
        limit: 500,
      });
      const counts: Record<string, number> = {};
      (response.consultations || []).forEach((c) => {
        const d = c.preferred_date?.slice(0, 10);
        if (d) counts[d] = (counts[d] || 0) + 1;
      });
      setMonthCounts(counts);
    } catch (err) {
      console.error('Failed to load month counts:', err);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // Time format
  const formatTime = (time: string | null | undefined) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
  };

  const formatGrade = (grade: string | null | undefined) => {
    if (!grade) return '';
    const gradeNum = parseInt(grade);
    if (gradeNum >= 1 && gradeNum <= 3) return `고${gradeNum}`;
    if (grade === 'N') return 'N수생';
    return grade;
  };

  const isFinished = (status: ConsultationStatus) => {
    return ['completed', 'cancelled', 'no_show'].includes(status);
  };

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

  const isToday = (date: Date) => {
    return toLocalDateStr(date) === toLocalDateStr(today);
  };

  const isSelected = (date: Date) => {
    return toLocalDateStr(date) === toLocalDateStr(selectedDate);
  };

  // Calendar grid
  const monthGrid = useMemo(
    () => getMonthGrid(calendarMonth.year, calendarMonth.month),
    [calendarMonth.year, calendarMonth.month]
  );

  // Format selected date for header
  const selectedDateLabel = useMemo(() => {
    const d = selectedDate;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    if (isToday(d)) {
      return `오늘 (${d.getMonth() + 1}/${d.getDate()} ${weekdays[d.getDay()]})`;
    }
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${weekdays[d.getDay()]})`;
  }, [selectedDate]);

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <button
              onClick={() => {
                setCalendarMonth({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
                setShowCalendar(!showCalendar);
              }}
              className="flex items-center gap-2 hover:text-primary transition"
            >
              <h1 className="text-xl font-bold text-foreground">{selectedDateLabel}</h1>
              <Calendar className={`h-5 w-5 text-muted-foreground transition-transform ${showCalendar ? 'text-primary' : ''}`} />
            </button>
            <p className="text-sm text-muted-foreground">상담 내역</p>
          </div>
        </div>
      </header>

      {/* Calendar dropdown */}
      {showCalendar && (
        <div className="bg-card border-b border-border px-4 pb-4 shadow-lg">
          {/* Month navigation */}
          <div className="flex items-center justify-between py-3">
            <button onClick={handlePrevMonth} className="p-2 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-foreground">
              {calendarMonth.year}년 {calendarMonth.month + 1}월
            </span>
            <button onClick={handleNextMonth} className="p-2 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW_LABELS.map((label, i) => (
              <div key={label} className={`text-center text-xs font-medium py-1 ${i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {monthGrid.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="h-10" />;
              }
              const dateStr = toLocalDateStr(date);
              const count = monthCounts[dateStr] || 0;
              const selected = isSelected(date);
              const todayMark = isToday(date);
              const dow = i % 7; // 0=Mon, 5=Sat, 6=Sun

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateSelect(date)}
                  className={`relative h-10 flex flex-col items-center justify-center rounded-lg transition-all text-sm
                    ${selected ? 'bg-primary text-primary-foreground font-bold' : ''}
                    ${!selected && todayMark ? 'ring-2 ring-primary ring-inset font-semibold' : ''}
                    ${!selected && !todayMark ? 'hover:bg-muted' : ''}
                    ${!selected && dow === 5 ? 'text-blue-500' : ''}
                    ${!selected && dow === 6 ? 'text-red-500' : ''}
                  `}
                >
                  <span>{date.getDate()}</span>
                  {count > 0 && (
                    <span className={`absolute bottom-0.5 text-[10px] font-bold leading-none ${selected ? 'text-primary-foreground/80' : 'text-green-600 dark:text-green-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick buttons */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <button
              onClick={() => handleDateSelect(today)}
              className="flex-1 text-sm py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition"
            >
              오늘
            </button>
          </div>
        </div>
      )}

      {/* Consultation list */}
      <main className="p-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">로딩 중...</div>
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">예정된 상담이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-card rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">상담</p>
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

            {/* Consultation cards */}
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
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(consultation.status)}`}>
                            {getStatusLabel(consultation.status)}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${finished ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className={`font-medium ${finished ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {formatTime(consultation.preferred_time)}
                          </span>
                          {consultation.student_grade && (
                            <>
                              <span className="text-muted-foreground/50">·</span>
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

      {/* Detail modal */}
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이름</p>
                  <p className="font-semibold text-lg text-foreground">{selectedConsultation.student_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">상담 시간</p>
                  <p className="font-semibold text-foreground">{formatTime(selectedConsultation.preferred_time)}</p>
                </div>
              </div>

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

              {selectedConsultation.parent_phone && (
                <a href={`tel:${selectedConsultation.parent_phone}`} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                    <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">학부모 전화번호</p>
                    <p className="font-semibold text-foreground">{selectedConsultation.parent_phone}</p>
                  </div>
                </a>
              )}

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

              {selectedConsultation.inquiry_content && (
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">문의 내용</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedConsultation.inquiry_content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
