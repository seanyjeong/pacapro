'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, Calendar, Clock, User, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getConsultationPageInfo,
  getAvailableSlots,
  submitConsultation
} from '@/lib/api/consultations';
import type {
  ConsultationPageInfo,
  ConsultationFormData,
  StudentGrade,
  TimeSlot
} from '@/lib/types/consultation';

// 체대입시 학원 - 중3부터
const GRADE_OPTIONS: StudentGrade[] = [
  '중3', '고1', '고2', '고3', 'N수', '성인'
];

const MOCK_SUBJECTS = ['국어', '수학', '영어', '탐구'] as const;

const ADMISSION_TYPES = [
  { value: 'early', label: '수시' },
  { value: 'regular', label: '정시' },
  { value: 'both', label: '수시+정시' }
];

export default function ConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [pageInfo, setPageInfo] = useState<ConsultationPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: 정보입력, 2: 일정선택, 3: 확인

  // 날짜/시간 선택
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 드롭다운 상태
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 폼 데이터
  const [formData, setFormData] = useState<ConsultationFormData>({
    consultationType: 'new_registration',
    parentName: '',
    parentPhone: '',
    studentName: '',
    studentPhone: '',
    studentGrade: undefined,
    studentSchool: '',
    mockTestGrades: {
      korean: undefined,
      math: undefined,
      english: undefined,
      exploration: undefined
    },
    schoolGradeAvg: undefined,
    admissionType: '',
    targetSchool: '',
    referrerStudent: '',
    referralSource: '',
    inquiryContent: '',
    preferredDate: '',
    preferredTime: ''
  });

  // 페이지 정보 로드
  useEffect(() => {
    loadPageInfo();
  }, [slug]);

  // 페이지 타이틀 동적 설정
  useEffect(() => {
    if (pageInfo?.academy?.name) {
      document.title = `${pageInfo.academy.name} - 상담 예약`;
    }
    return () => {
      // 페이지 떠날 때 기본 타이틀로 복원
      document.title = 'P-ACA - 체육입시 학원관리시스템';
    };
  }, [pageInfo?.academy?.name]);

  // 날짜 선택 시 슬롯 로드
  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  }, [selectedDate]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown && !(e.target as Element).closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  const loadPageInfo = async () => {
    try {
      const info = await getConsultationPageInfo(slug);
      setPageInfo(info);
    } catch (error: any) {
      toast.error(error.message || '페이지를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async (date: Date) => {
    setSlotsLoading(true);
    setSelectedTime('');
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await getAvailableSlots(slug, dateStr);
      setAvailableSlots(response.slots || []);
    } catch (error: any) {
      toast.error('시간 정보를 불러올 수 없습니다.');
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('날짜와 시간을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const submitData: ConsultationFormData = {
        ...formData,
        preferredDate: format(selectedDate, 'yyyy-MM-dd'),
        preferredTime: selectedTime
      };

      await submitConsultation(slug, submitData);
      router.push(`/c/${slug}/success`);
    } catch (error: any) {
      toast.error(error.message || '상담 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep1 = () => {
    if (!formData.studentName.trim()) {
      toast.error('학생 이름을 입력해주세요.');
      return false;
    }
    if (!formData.studentPhone?.trim()) {
      toast.error('연락처를 입력해주세요.');
      return false;
    }
    if (!formData.studentGrade) {
      toast.error('학년을 선택해주세요.');
      return false;
    }
    if (!formData.studentSchool?.trim()) {
      toast.error('학교를 입력해주세요.');
      return false;
    }
    // 성적 정보 필수 체크
    if (formData.schoolGradeAvg === undefined) {
      toast.error('내신 평균등급을 선택해주세요.');
      return false;
    }
    if (!formData.admissionType) {
      toast.error('입시 유형을 선택해주세요.');
      return false;
    }
    const mockGrades = formData.mockTestGrades;
    if (!mockGrades?.korean && mockGrades?.korean !== -1) {
      toast.error('모의고사 국어 등급을 선택해주세요.');
      return false;
    }
    if (!mockGrades?.math && mockGrades?.math !== -1) {
      toast.error('모의고사 수학 등급을 선택해주세요.');
      return false;
    }
    if (!mockGrades?.english && mockGrades?.english !== -1) {
      toast.error('모의고사 영어 등급을 선택해주세요.');
      return false;
    }
    if (!mockGrades?.exploration && mockGrades?.exploration !== -1) {
      toast.error('모의고사 탐구 등급을 선택해주세요.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!selectedDate || !selectedTime) {
      toast.error('상담 일정을 선택해주세요.');
      return false;
    }
    return true;
  };

  // 커스텀 드롭다운 컴포넌트
  const CustomDropdown = ({
    id,
    value,
    options,
    placeholder,
    onChange,
    renderOption
  }: {
    id: string;
    value: string;
    options: { value: string; label: string }[];
    placeholder: string;
    onChange: (value: string) => void;
    renderOption?: (opt: { value: string; label: string }) => React.ReactNode;
  }) => {
    const isOpen = openDropdown === id;
    const selectedOption = options.find(o => o.value === value);

    return (
      <div className="dropdown-container relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdown(isOpen ? null : id);
          }}
          className="w-full px-3 py-2 text-left border rounded-lg bg-white text-sm flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setOpenDropdown(null);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  value === opt.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 캘린더 생성
  const generateCalendarDays = () => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, pageInfo?.settings?.advanceDays || 30);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    // 첫 주 빈칸
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // 날짜
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return { days, today, maxDate };
  };

  const isDateAvailable = (date: Date, today: Date, maxDate: Date) => {
    if (isBefore(date, today)) return false;
    if (isBefore(maxDate, date)) return false;

    const dayOfWeek = date.getDay();
    const weeklyHour = pageInfo?.weeklyHours?.find(h => h.dayOfWeek === dayOfWeek);
    return weeklyHour?.isAvailable ?? false;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!pageInfo) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">404</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">페이지를 찾을 수 없습니다</h2>
        <p className="text-gray-500">올바른 링크인지 확인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {pageInfo.academy?.name} 상담예약
        </h1>
        {pageInfo.settings?.pageDescription && (
          <p className="text-sm text-gray-600">{pageInfo.settings.pageDescription}</p>
        )}
      </div>

      {/* 진행 단계 표시 */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-8 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-6 text-xs text-gray-500">
        <span>정보 입력</span>
        <span>일정 선택</span>
        <span>확인</span>
      </div>

      {/* Step 1: 정보 입력 */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          {/* 학생 정보 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              학생 정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">이름 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  placeholder="홍길동"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">연락처 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.studentPhone || ''}
                  onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">학년 <span className="text-red-500">*</span></Label>
                <div className="mt-1">
                  <CustomDropdown
                    id="studentGrade"
                    value={formData.studentGrade || ''}
                    options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
                    placeholder="선택"
                    onChange={(v) => setFormData({ ...formData, studentGrade: v as StudentGrade })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">학교 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.studentSchool || ''}
                  onChange={(e) => setFormData({ ...formData, studentSchool: e.target.value })}
                  placeholder="OO고등학교"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 성적 정보 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">성적 정보 <span className="text-red-500">*</span></h3>

            {/* 내신등급 + 입시유형 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">내신 평균등급 <span className="text-red-500">*</span></Label>
                <div className="mt-1">
                  <CustomDropdown
                    id="schoolGradeAvg"
                    value={formData.schoolGradeAvg?.toString() || ''}
                    options={[
                      { value: 'none', label: '미응시' },
                      ...([1,2,3,4,5,6,7,8,9].map(g => ({ value: g.toString(), label: `${g}등급` })))
                    ]}
                    placeholder="선택"
                    onChange={(v) => setFormData({ ...formData, schoolGradeAvg: v === 'none' ? -1 : parseInt(v) })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">입시 유형 <span className="text-red-500">*</span></Label>
                <div className="mt-1">
                  <CustomDropdown
                    id="admissionType"
                    value={formData.admissionType || ''}
                    options={ADMISSION_TYPES}
                    placeholder="선택"
                    onChange={(v) => setFormData({ ...formData, admissionType: v })}
                  />
                </div>
              </div>
            </div>

            {/* 모의고사 등급 */}
            <div>
              <Label className="text-xs mb-1 block">모의고사 등급 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-4 gap-2">
                {MOCK_SUBJECTS.map((subject) => {
                  const key = subject === '국어' ? 'korean' : subject === '수학' ? 'math' : subject === '영어' ? 'english' : 'exploration';
                  return (
                    <div key={subject}>
                      <Label className="text-xs text-center block mb-1 text-gray-500">{subject}</Label>
                      <CustomDropdown
                        id={`mock_${key}`}
                        value={formData.mockTestGrades?.[key]?.toString() || ''}
                        options={[
                          { value: 'none', label: '미응시' },
                          ...([1,2,3,4,5,6,7,8,9].map(g => ({ value: g.toString(), label: `${g}등급` })))
                        ]}
                        placeholder="선택"
                        onChange={(v) => setFormData({
                          ...formData,
                          mockTestGrades: {
                            ...formData.mockTestGrades,
                            [key]: v === 'none' ? -1 : parseInt(v)
                          }
                        })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">희망 학교</Label>
              <Input
                value={formData.targetSchool || ''}
                onChange={(e) => setFormData({ ...formData, targetSchool: e.target.value })}
                placeholder="목표 대학교"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">소개해주신 재원생</Label>
              <Input
                value={formData.referrerStudent || ''}
                onChange={(e) => setFormData({ ...formData, referrerStudent: e.target.value })}
                placeholder="재원생 이름 (해당 시)"
                className="mt-1"
              />
            </div>
            {pageInfo.settings?.referralSources && pageInfo.settings.referralSources.length > 0 && (
              <div>
                <Label className="text-xs">학원을 알게 된 경로</Label>
                <div className="mt-1">
                  <CustomDropdown
                    id="referralSource"
                    value={formData.referralSource || ''}
                    options={pageInfo.settings.referralSources.map(s => ({ value: s, label: s }))}
                    placeholder="선택해주세요"
                    onChange={(v) => setFormData({ ...formData, referralSource: v })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">문의 내용</Label>
              <Textarea
                value={formData.inquiryContent || ''}
                onChange={(e) => setFormData({ ...formData, inquiryContent: e.target.value })}
                placeholder="궁금하신 점이나 상담 시 전달하고 싶은 내용을 적어주세요."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <Button
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className="w-full"
          >
            다음: 일정 선택
          </Button>
        </div>
      )}

      {/* Step 2: 일정 선택 */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              상담 일정 선택
            </h3>
          </div>

          {/* 달력 */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-medium">
                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
              </span>
              <button
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                <div
                  key={day}
                  className={`py-1 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const { days, today, maxDate } = generateCalendarDays();
                return days.map((date, i) => {
                  if (!date) {
                    return <div key={`empty-${i}`} className="h-10" />;
                  }

                  const available = isDateAvailable(date, today, maxDate);
                  const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const dayOfWeek = date.getDay();

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => available && setSelectedDate(date)}
                      disabled={!available}
                      className={`h-10 rounded-lg text-sm transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : available
                            ? 'hover:bg-blue-50 text-gray-700'
                            : 'text-gray-300 cursor-not-allowed'
                      } ${isToday && !isSelected ? 'ring-2 ring-blue-400 ring-inset' : ''} ${
                        dayOfWeek === 0 && !isSelected ? 'text-red-400' : dayOfWeek === 6 && !isSelected ? 'text-blue-400' : ''
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* 시간 선택 */}
          {selectedDate && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })} 가능 시간
              </h4>

              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : availableSlots.filter(s => s.available).length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  예약 가능한 시간이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.filter(s => s.available).map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedTime === slot.time
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {slot.time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => {
              if (validateStep2()) setStep(3);
            }}
            disabled={!selectedDate || !selectedTime}
            className="w-full"
          >
            다음: 확인
          </Button>
        </div>
      )}

      {/* Step 3: 확인 */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(2)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-sm font-semibold text-gray-700">신청 내용 확인</h3>
          </div>

          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="font-semibold text-blue-900 mb-2">상담 일정</div>
              <div className="text-blue-800">
                {selectedDate && format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                {' '}
                {selectedTime?.slice(0, 5)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-gray-600">
              <div>
                <div className="text-xs text-gray-400">이름</div>
                <div className="font-medium text-gray-900">{formData.studentName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">연락처</div>
                <div className="font-medium text-gray-900">{formData.studentPhone}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">학년</div>
                <div className="font-medium text-gray-900">{formData.studentGrade}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">학교</div>
                <div className="font-medium text-gray-900">{formData.studentSchool}</div>
              </div>
              {formData.schoolGradeAvg && (
                <div>
                  <div className="text-xs text-gray-400">내신 평균</div>
                  <div className="font-medium text-gray-900">{formData.schoolGradeAvg}등급</div>
                </div>
              )}
              {formData.admissionType && (
                <div>
                  <div className="text-xs text-gray-400">입시 유형</div>
                  <div className="font-medium text-gray-900">
                    {formData.admissionType === 'early' ? '수시' : formData.admissionType === 'regular' ? '정시' : '수시+정시'}
                  </div>
                </div>
              )}
            </div>

            {(formData.mockTestGrades?.korean || formData.mockTestGrades?.math || formData.mockTestGrades?.english || formData.mockTestGrades?.exploration) && (
              <div>
                <div className="text-xs text-gray-400 mb-1">모의고사 등급</div>
                <div className="flex flex-wrap gap-3 text-gray-700">
                  {formData.mockTestGrades?.korean && <span>국어 {formData.mockTestGrades.korean}등급</span>}
                  {formData.mockTestGrades?.math && <span>수학 {formData.mockTestGrades.math}등급</span>}
                  {formData.mockTestGrades?.english && <span>영어 {formData.mockTestGrades.english}등급</span>}
                  {formData.mockTestGrades?.exploration && <span>탐구 {formData.mockTestGrades.exploration}등급</span>}
                </div>
              </div>
            )}

            {formData.inquiryContent && (
              <div>
                <div className="text-xs text-gray-400 mb-1">문의 내용</div>
                <div className="text-gray-700 bg-gray-50 rounded-lg p-3">
                  {formData.inquiryContent}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                신청 중...
              </>
            ) : (
              '상담 신청하기'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
