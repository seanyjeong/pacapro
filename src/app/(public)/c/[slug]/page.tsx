'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, Calendar, Clock, User, Phone, School, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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

const GRADE_OPTIONS: StudentGrade[] = [
  '중1', '중2', '중3', '고1', '고2', '고3', 'N수'
];

const CONSULTATION_TYPES = [
  { value: 'new_registration', label: '신규 등록 상담' },
  { value: 'learning', label: '학습 상담' }
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

  // 폼 데이터
  const [formData, setFormData] = useState<ConsultationFormData>({
    consultationType: 'new_registration',
    parentName: '',
    parentPhone: '',
    studentName: '',
    studentGrade: undefined,
    studentSchool: '',
    schoolGrade: undefined,
    mockTestGrade: undefined,
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

  // 날짜 선택 시 슬롯 로드
  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  }, [selectedDate]);

  const loadPageInfo = async () => {
    try {
      const info = await getConsultationPageInfo(slug);
      setPageInfo(info);
      if (info.referralSources && info.referralSources.length > 0) {
        setFormData(prev => ({ ...prev, referralSource: '' }));
      }
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
    if (!formData.parentName.trim()) {
      toast.error('학부모 성함을 입력해주세요.');
      return false;
    }
    if (!formData.parentPhone.trim()) {
      toast.error('연락처를 입력해주세요.');
      return false;
    }
    if (!formData.studentName.trim()) {
      toast.error('학생 이름을 입력해주세요.');
      return false;
    }
    if (!formData.studentGrade) {
      toast.error('학년을 선택해주세요.');
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

  // 캘린더 생성
  const generateCalendarDays = () => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, pageInfo?.advanceDays || 30);

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
          {pageInfo.pageTitle || `${pageInfo.academyName} 상담 예약`}
        </h1>
        {pageInfo.pageDescription && (
          <p className="text-sm text-gray-600">{pageInfo.pageDescription}</p>
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
          {/* 상담 유형 */}
          <div>
            <Label className="text-sm font-medium">상담 유형</Label>
            <Select
              value={formData.consultationType}
              onValueChange={(v) => setFormData({ ...formData, consultationType: v as any })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONSULTATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 학부모 정보 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              학부모 정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">성함 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  placeholder="홍길동"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">연락처 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* 학생 정보 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <School className="h-4 w-4" />
              학생 정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">이름 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  placeholder="홍길순"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">학년 <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.studentGrade || ''}
                  onValueChange={(v) => setFormData({ ...formData, studentGrade: v as StudentGrade })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
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
              <Label className="text-xs">학교</Label>
              <Input
                value={formData.studentSchool || ''}
                onChange={(e) => setFormData({ ...formData, studentSchool: e.target.value })}
                placeholder="OO고등학교"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">내신 등급</Label>
                <Select
                  value={formData.schoolGrade?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, schoolGrade: parseInt(v) as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g}등급
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">모의고사 등급</Label>
                <Select
                  value={formData.mockTestGrade?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, mockTestGrade: parseInt(v) as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g}등급
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {pageInfo.referralSources && pageInfo.referralSources.length > 0 && (
              <div>
                <Label className="text-xs">학원을 알게 된 경로</Label>
                <Select
                  value={formData.referralSource || ''}
                  onValueChange={(v) => setFormData({ ...formData, referralSource: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageInfo.referralSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : ''
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
              ) : availableSlots.length === 0 ? (
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
                <div className="text-xs text-gray-400">학부모</div>
                <div className="font-medium text-gray-900">{formData.parentName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">연락처</div>
                <div className="font-medium text-gray-900">{formData.parentPhone}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">학생</div>
                <div className="font-medium text-gray-900">{formData.studentName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">학년</div>
                <div className="font-medium text-gray-900">{formData.studentGrade}</div>
              </div>
              {formData.studentSchool && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-400">학교</div>
                  <div className="font-medium text-gray-900">{formData.studentSchool}</div>
                </div>
              )}
              {formData.schoolGrade && (
                <div>
                  <div className="text-xs text-gray-400">내신</div>
                  <div className="font-medium text-gray-900">{formData.schoolGrade}등급</div>
                </div>
              )}
              {formData.mockTestGrade && (
                <div>
                  <div className="text-xs text-gray-400">모의고사</div>
                  <div className="font-medium text-gray-900">{formData.mockTestGrade}등급</div>
                </div>
              )}
            </div>

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
