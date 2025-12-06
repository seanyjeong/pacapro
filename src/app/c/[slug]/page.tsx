'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, User, Phone, School, BookOpen, Target, Users, MessageSquare, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getConsultationPageInfo, getAvailableSlots, submitConsultation } from '@/lib/api/consultations';
import type { ConsultationPageInfo, ConsultationFormData, TimeSlot, StudentGrade, AcademicScores } from '@/lib/types/consultation';
import { GRADE_OPTIONS, DAY_LABELS } from '@/lib/types/consultation';

export default function ConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [pageInfo, setPageInfo] = useState<ConsultationPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState<Partial<ConsultationFormData>>({
    consultationType: 'new_registration'
  });

  // 성적 데이터
  const [academicScores, setAcademicScores] = useState<AcademicScores>({
    school_grades: {},
    mock_exam_grades: {},
    percentiles: {}
  });

  // 선택된 날짜 및 시간
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 알게 된 경로 선택
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);

  // 날짜 선택용 상태
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 페이지 정보 로드
  useEffect(() => {
    async function loadPageInfo() {
      try {
        const info = await getConsultationPageInfo(slug);
        setPageInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : '페이지를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadPageInfo();
  }, [slug]);

  // 날짜 선택 시 슬롯 로드
  useEffect(() => {
    if (!selectedDate) return;

    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const response = await getAvailableSlots(slug, selectedDate!);
        setSlots(response.slots);
        setSelectedTime(null);
      } catch (err) {
        console.error('슬롯 로드 오류:', err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [slug, selectedDate]);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.parentName || !formData.parentPhone || !formData.studentName || !formData.studentGrade) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }

    if (!selectedDate || !selectedTime) {
      alert('상담 희망 일시를 선택해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const submitData: ConsultationFormData = {
        consultationType: formData.consultationType || 'new_registration',
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        studentName: formData.studentName,
        studentGrade: formData.studentGrade,
        studentSchool: formData.studentSchool,
        academicScores: academicScores,
        targetSchool: formData.targetSchool,
        referrerStudent: formData.referrerStudent,
        referralSources: selectedReferrals,
        inquiryContent: formData.inquiryContent,
        preferredDate: selectedDate,
        preferredTime: selectedTime
      };

      await submitConsultation(slug, submitData);
      router.push(`/c/${slug}/success`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '상담 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 날짜 선택 가능 여부 확인
  const isDateAvailable = (date: Date) => {
    if (!pageInfo) return false;

    const dayOfWeek = date.getDay();
    const weeklyHour = pageInfo.weeklyHours.find(h => h.dayOfWeek === dayOfWeek);

    if (!weeklyHour || !weeklyHour.isAvailable) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = addDays(today, pageInfo.settings.advanceDays);

    return date >= today && date <= maxDate;
  };

  // 캘린더 렌더링
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    // 빈 칸
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // 날짜
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {DAY_LABELS.map((day, i) => (
            <div
              key={day}
              className={`py-2 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}
            >
              {day}
            </div>
          ))}

          {days.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="py-2" />;
            }

            const dateStr = format(date, 'yyyy-MM-dd');
            const isAvailable = isDateAvailable(date);
            const isSelected = selectedDate === dateStr;
            const dayOfWeek = date.getDay();

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!isAvailable}
                onClick={() => setSelectedDate(dateStr)}
                className={`py-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isAvailable
                    ? 'hover:bg-blue-50 cursor-pointer'
                    : 'text-gray-300 cursor-not-allowed'
                } ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''} ${
                  isSelected ? '!text-white' : ''
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 시간 슬롯 렌더링
  const renderTimeSlots = () => {
    if (!selectedDate) {
      return (
        <div className="text-center text-gray-500 py-8">
          날짜를 먼저 선택해주세요.
        </div>
      );
    }

    if (loadingSlots) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      );
    }

    if (slots.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          해당 날짜에 예약 가능한 시간이 없습니다.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            disabled={!slot.available}
            onClick={() => setSelectedTime(slot.time)}
            className={`py-2 px-3 rounded-lg text-sm transition-colors ${
              selectedTime === slot.time
                ? 'bg-blue-600 text-white'
                : slot.available
                ? 'bg-gray-100 hover:bg-blue-50'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
    );
  };

  // 등급 선택 컴포넌트
  const GradeSelect = ({
    label,
    value,
    onChange
  }: {
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
  }) => (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      <Select
        value={value?.toString() || ''}
        onValueChange={(v) => onChange(v ? parseInt(v) : undefined)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">-</SelectItem>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
            <SelectItem key={grade} value={grade.toString()}>
              {grade}등급
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !pageInfo) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {error || '페이지를 찾을 수 없습니다.'}
        </h1>
        <p className="text-gray-500">
          올바른 링크인지 확인해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {pageInfo.academy.name}
        </h1>
        <h2 className="text-xl text-gray-600 mt-1">
          {pageInfo.settings.pageTitle}
        </h2>
        {pageInfo.settings.pageDescription && (
          <p className="text-gray-500 mt-3 text-sm">
            {pageInfo.settings.pageDescription}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 상담 유형 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              상담 유형
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="consultationType"
                  value="new_registration"
                  checked={formData.consultationType === 'new_registration'}
                  onChange={() => setFormData({ ...formData, consultationType: 'new_registration' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span>신규 등록 상담</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="consultationType"
                  value="learning"
                  checked={formData.consultationType === 'learning'}
                  onChange={() => setFormData({ ...formData, consultationType: 'learning' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span>학습 상담</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 학부모 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              학부모 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>이름 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.parentName || ''}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <Label>연락처 <span className="text-red-500">*</span></Label>
                <Input
                  type="tel"
                  value={formData.parentPhone || ''}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  placeholder="010-1234-5678"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 학생 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <School className="h-5 w-5" />
              학생 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>이름 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.studentName || ''}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  placeholder="홍길순"
                  required
                />
              </div>
              <div>
                <Label>학년 <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.studentGrade || ''}
                  onValueChange={(v) => setFormData({ ...formData, studentGrade: v as StudentGrade })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="학년 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>학교</Label>
              <Input
                value={formData.studentSchool || ''}
                onChange={(e) => setFormData({ ...formData, studentSchool: e.target.value })}
                placeholder="OO고등학교"
              />
            </div>
          </CardContent>
        </Card>

        {/* 성적 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              성적 정보 (선택)
            </CardTitle>
            <CardDescription>
              알고 계신 성적이 있으면 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 내신 등급 */}
            <div>
              <Label className="font-medium mb-2 block">내신 등급</Label>
              <div className="grid grid-cols-4 gap-3">
                <GradeSelect
                  label="국어"
                  value={academicScores.school_grades?.korean}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    school_grades: { ...academicScores.school_grades, korean: v }
                  })}
                />
                <GradeSelect
                  label="수학"
                  value={academicScores.school_grades?.math}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    school_grades: { ...academicScores.school_grades, math: v }
                  })}
                />
                <GradeSelect
                  label="영어"
                  value={academicScores.school_grades?.english}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    school_grades: { ...academicScores.school_grades, english: v }
                  })}
                />
                <GradeSelect
                  label="탐구"
                  value={academicScores.school_grades?.exploration}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    school_grades: { ...academicScores.school_grades, exploration: v }
                  })}
                />
              </div>
            </div>

            {/* 모의고사 등급 */}
            <div>
              <Label className="font-medium mb-2 block">모의고사 등급</Label>
              <div className="grid grid-cols-4 gap-3">
                <GradeSelect
                  label="국어"
                  value={academicScores.mock_exam_grades?.korean}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    mock_exam_grades: { ...academicScores.mock_exam_grades, korean: v }
                  })}
                />
                <GradeSelect
                  label="수학"
                  value={academicScores.mock_exam_grades?.math}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    mock_exam_grades: { ...academicScores.mock_exam_grades, math: v }
                  })}
                />
                <GradeSelect
                  label="영어"
                  value={academicScores.mock_exam_grades?.english}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    mock_exam_grades: { ...academicScores.mock_exam_grades, english: v }
                  })}
                />
                <GradeSelect
                  label="탐구"
                  value={academicScores.mock_exam_grades?.exploration}
                  onChange={(v) => setAcademicScores({
                    ...academicScores,
                    mock_exam_grades: { ...academicScores.mock_exam_grades, exploration: v }
                  })}
                />
              </div>
            </div>

            {/* 백분위 */}
            <div>
              <Label className="font-medium mb-2 block">백분위 (선택)</Label>
              <div className="grid grid-cols-4 gap-3">
                {['korean', 'math', 'english', 'exploration'].map((subject) => (
                  <div key={subject}>
                    <Label className="text-xs text-gray-500">
                      {subject === 'korean' ? '국어' : subject === 'math' ? '수학' : subject === 'english' ? '영어' : '탐구'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      className="h-9"
                      placeholder="-"
                      value={academicScores.percentiles?.[subject as keyof typeof academicScores.percentiles] || ''}
                      onChange={(e) => setAcademicScores({
                        ...academicScores,
                        percentiles: {
                          ...academicScores.percentiles,
                          [subject]: e.target.value ? parseInt(e.target.value) : undefined
                        }
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기타 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              기타 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>목표 학교</Label>
                <Input
                  value={formData.targetSchool || ''}
                  onChange={(e) => setFormData({ ...formData, targetSchool: e.target.value })}
                  placeholder="희망 대학/학과"
                />
              </div>
              <div>
                <Label>추천 원생</Label>
                <Input
                  value={formData.referrerStudent || ''}
                  onChange={(e) => setFormData({ ...formData, referrerStudent: e.target.value })}
                  placeholder="소개해준 학생 이름"
                />
              </div>
            </div>

            {/* 알게 된 경로 */}
            <div>
              <Label className="mb-2 block">학원을 알게 된 경로</Label>
              <div className="flex flex-wrap gap-3">
                {pageInfo.settings.referralSources.map((source) => (
                  <label key={source} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedReferrals.includes(source)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedReferrals([...selectedReferrals, source]);
                        } else {
                          setSelectedReferrals(selectedReferrals.filter(s => s !== source));
                        }
                      }}
                    />
                    <span className="text-sm">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 문의 내용 */}
            <div>
              <Label>문의 내용</Label>
              <Textarea
                value={formData.inquiryContent || ''}
                onChange={(e) => setFormData({ ...formData, inquiryContent: e.target.value })}
                placeholder="상담 시 궁금한 점이나 문의 사항을 입력해주세요."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* 상담 일시 선택 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              상담 희망 일시 <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 날짜 선택 */}
            <div>
              <Label className="mb-2 block">날짜 선택</Label>
              {renderCalendar()}
            </div>

            {/* 시간 선택 */}
            <div>
              <Label className="mb-2 block flex items-center gap-2">
                <Clock className="h-4 w-4" />
                시간 선택
                {selectedDate && (
                  <span className="text-sm font-normal text-gray-500">
                    ({format(parseISO(selectedDate), 'M월 d일 (EEE)', { locale: ko })})
                  </span>
                )}
              </Label>
              {renderTimeSlots()}
            </div>
          </CardContent>
        </Card>

        {/* 제출 버튼 */}
        <Button
          type="submit"
          className="w-full h-12 text-lg"
          disabled={submitting || !selectedDate || !selectedTime}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              신청 중...
            </>
          ) : (
            '상담 신청하기'
          )}
        </Button>
      </form>
    </div>
  );
}
