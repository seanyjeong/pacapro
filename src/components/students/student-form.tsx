/**
 * Student Form Component
 * 학생 등록/수정 폼 컴포넌트 (공용) - 입시생/성인 구분 지원
 * - 요일 선택 시 주 수업횟수 자동 계산
 * - 설정에서 학원비 자동 불러오기
 * - 할인 적용 시 할인사유 입력 및 실납부액 자동 계산
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { seasonsApi } from '@/lib/api/seasons';
import type { Student, StudentFormData, StudentType, Grade, AdmissionType, StudentStatus } from '@/lib/types/student';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS, formatSeasonFee } from '@/lib/types/season';
import {
  STUDENT_TYPE_OPTIONS,
  GRADE_OPTIONS,
  EXAM_ADMISSION_OPTIONS,
  ADULT_ADMISSION_OPTIONS,
  STATUS_OPTIONS,
  WEEKDAY_OPTIONS,
} from '@/lib/types/student';
import { parseClassDays } from '@/lib/utils/student-helpers';

// 학원비 설정 타입 (설정 페이지와 동일)
interface TuitionByWeeklyCount {
  weekly_1: number;
  weekly_2: number;
  weekly_3: number;
  weekly_4: number;
  weekly_5: number;
  weekly_6: number;
  weekly_7: number;
}

interface AcademySettings {
  exam_tuition: TuitionByWeeklyCount;
  adult_tuition: TuitionByWeeklyCount;
  tuition_due_day?: number; // 학원 기본 납부일
}

const DEFAULT_TUITION: TuitionByWeeklyCount = {
  weekly_1: 0,
  weekly_2: 0,
  weekly_3: 0,
  weekly_4: 0,
  weekly_5: 0,
  weekly_6: 0,
  weekly_7: 0,
};

interface StudentFormProps {
  mode: 'create' | 'edit';
  initialData?: Student;
  onSubmit: (data: StudentFormData) => Promise<void>;
  onCancel: () => void;
}

export function StudentForm({ mode, initialData, onSubmit, onCancel }: StudentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 학원 설정 (학원비 기준표)
  const [academySettings, setAcademySettings] = useState<AcademySettings>({
    exam_tuition: { ...DEFAULT_TUITION },
    adult_tuition: { ...DEFAULT_TUITION },
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 시즌 등록 관련 상태
  const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [enrollInSeason, setEnrollInSeason] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  // 폼 데이터 초기화
  const [formData, setFormData] = useState<StudentFormData>({
    student_number: initialData?.student_number || '',
    name: initialData?.name || '',
    student_type: (initialData?.student_type || 'exam') as StudentType,
    phone: initialData?.phone || '',
    parent_phone: initialData?.parent_phone || '',
    school: initialData?.school || '',
    grade: initialData?.grade as Grade | undefined,
    age: initialData?.age || undefined,
    admission_type: (initialData?.admission_type || 'regular') as AdmissionType,
    class_days: initialData ? parseClassDays(initialData.class_days) : [],
    weekly_count: initialData?.weekly_count || 0,
    monthly_tuition: initialData ? parseFloat(initialData.monthly_tuition) : 0,
    discount_rate: initialData ? parseFloat(initialData.discount_rate) : 0,
    discount_reason: initialData?.discount_reason || '',
    payment_due_day: initialData?.payment_due_day || undefined,
    enrollment_date: initialData?.enrollment_date || new Date().toISOString().split('T')[0],
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    status: (initialData?.status || 'active') as StudentStatus,
    rest_start_date: initialData?.rest_start_date || '',
    rest_end_date: initialData?.rest_end_date || '',
    rest_reason: initialData?.rest_reason || '',
  });

  // 휴식 설정 관련 상태
  const [isIndefiniteRest, setIsIndefiniteRest] = useState(!initialData?.rest_end_date && initialData?.status === 'paused');

  // 학원 설정 로드
  useEffect(() => {
    loadAcademySettings();
  }, []);

  // 시즌 대상 학년(고3, N수)일 때 활성 시즌 로드
  const isSeasonTarget = formData.student_type === 'exam' && (formData.grade === '고3' || formData.grade === 'N수');

  useEffect(() => {
    if (isSeasonTarget && mode === 'create') {
      loadAvailableSeasons();
    }
  }, [isSeasonTarget, mode]);

  const loadAvailableSeasons = async () => {
    try {
      setSeasonsLoading(true);
      const seasons = await seasonsApi.getActiveSeasons();
      setAvailableSeasons(seasons);
    } catch (err) {
      console.error('Failed to load seasons:', err);
    } finally {
      setSeasonsLoading(false);
    }
  };

  const loadAcademySettings = async () => {
    try {
      const response = await apiClient.get<{ settings: AcademySettings }>('/settings/academy');
      if (response.settings) {
        setAcademySettings({
          exam_tuition: response.settings.exam_tuition || { ...DEFAULT_TUITION },
          adult_tuition: response.settings.adult_tuition || { ...DEFAULT_TUITION },
          tuition_due_day: response.settings.tuition_due_day,
        });
      }
    } catch {
      // 설정이 없으면 기본값 사용
    } finally {
      setSettingsLoaded(true);
    }
  };

  // 주 수업횟수에 따른 학원비 가져오기
  const getTuitionByWeeklyCount = (studentType: StudentType, weeklyCount: number): number => {
    if (weeklyCount < 1 || weeklyCount > 7) return 0;

    const tuitionTable = studentType === 'exam'
      ? academySettings.exam_tuition
      : academySettings.adult_tuition;

    const key = `weekly_${weeklyCount}` as keyof TuitionByWeeklyCount;
    return tuitionTable[key] || 0;
  };

  // 실납부액 계산 (월학원비 - 할인)
  const finalTuition = useMemo(() => {
    const base = formData.monthly_tuition || 0;
    const discountRate = formData.discount_rate || 0;
    const discountAmount = Math.round(base * (discountRate / 100));
    return base - discountAmount;
  }, [formData.monthly_tuition, formData.discount_rate]);

  // 입력값 변경 핸들러
  const handleChange = (field: keyof StudentFormData, value: unknown) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // 학생 유형 변경 시 관련 필드 초기화 및 학원비 재설정
      if (field === 'student_type') {
        if (value === 'adult') {
          newData.grade = undefined;
          newData.admission_type = 'civil_service';
        } else {
          newData.age = undefined;
          newData.admission_type = 'regular';
        }
        // 학생 유형 변경 시 학원비도 재설정
        if (settingsLoaded && newData.weekly_count > 0) {
          newData.monthly_tuition = getTuitionByWeeklyCount(value as StudentType, newData.weekly_count);
        }
      }

      return newData;
    });

    // 에러 초기화
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 수업요일 체크박스 핸들러 - 주 수업횟수 자동 계산 및 학원비 설정
  const handleClassDayToggle = (day: number) => {
    const current = formData.class_days;
    const newDays = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);

    const newWeeklyCount = newDays.length;

    // 설정에서 학원비 가져오기
    const newTuition = settingsLoaded
      ? getTuitionByWeeklyCount(formData.student_type, newWeeklyCount)
      : formData.monthly_tuition;

    setFormData((prev) => ({
      ...prev,
      class_days: newDays,
      weekly_count: newWeeklyCount,
      monthly_tuition: newTuition,
    }));
  };

  // 유효성 검사
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = '전화번호를 입력해주세요.';
    }

    if (formData.student_type === 'exam') {
      if (!formData.grade) {
        newErrors.grade = '학년을 선택해주세요.';
      }
    } else {
      if (!formData.age || formData.age < 1) {
        newErrors.age = '나이를 입력해주세요.';
      }
    }

    // 할인율이 있는데 할인사유가 없으면 경고
    if ((formData.discount_rate || 0) > 0 && !formData.discount_reason?.trim()) {
      newErrors.discount_reason = '할인 사유를 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // 시즌 등록 정보 포함
    const submitData = {
      ...formData,
      enroll_in_season: enrollInSeason && !!selectedSeasonId,
      selected_season_id: enrollInSeason ? selectedSeasonId ?? undefined : undefined,
    };

    try {
      setSubmitting(true);
      await onSubmit(submitData);
    } catch (err: unknown) {
      console.error('Form submit error:', err);
      const errorMessage = err instanceof Error ? err.message : '저장에 실패했습니다.';
      setErrors({ submit: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  // 입시유형 옵션 (학생 유형에 따라)
  const admissionOptions = formData.student_type === 'exam' ? EXAM_ADMISSION_OPTIONS : ADULT_ADMISSION_OPTIONS;

  // 숫자 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="홍길동"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* 학번 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                학번 {mode === 'create' && <span className="text-gray-500 text-xs">(자동생성 가능)</span>}
              </label>
              <input
                type="text"
                value={formData.student_number || ''}
                onChange={(e) => handleChange('student_number', e.target.value)}
                placeholder="2024001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="010-1234-5678"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* 학부모 전화번호 - 입시생일 때만 표시 */}
            {formData.student_type === 'exam' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">학부모 전화번호</label>
                <input
                  type="tel"
                  value={formData.parent_phone || ''}
                  onChange={(e) => handleChange('parent_phone', e.target.value)}
                  placeholder="010-9876-5432"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {/* 학교 - 입시생일 때만 표시 */}
            {formData.student_type === 'exam' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">학교</label>
                <input
                  type="text"
                  value={formData.school || ''}
                  onChange={(e) => handleChange('school', e.target.value)}
                  placeholder="서울고등학교"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 학생 유형 & 학년/나이 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>학생 유형</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 학생 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                학생 유형 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.student_type}
                onChange={(e) => handleChange('student_type', e.target.value as StudentType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STUDENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 학년 - 입시생일 때만 표시 */}
            {formData.student_type === 'exam' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  학년 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.grade || ''}
                  onChange={(e) => handleChange('grade', e.target.value as Grade || undefined)}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.grade ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">선택하세요</option>
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.grade && <p className="text-red-500 text-sm mt-1">{errors.grade}</p>}
              </div>
            )}

            {/* 나이 - 성인일 때만 표시 */}
            {formData.student_type === 'adult' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  나이 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => handleChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="25"
                  min="1"
                  max="100"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.age ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
              </div>
            )}

            {/* 입시유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.student_type === 'exam' ? '입시유형' : '목표'}
              </label>
              <select
                value={formData.admission_type}
                onChange={(e) => handleChange('admission_type', e.target.value as AdmissionType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {admissionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 수업 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>수업 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 수업요일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수업요일 <span className="text-gray-500 text-xs">(선택하면 주 수업횟수가 자동 계산됩니다)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleClassDayToggle(option.value)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    formData.class_days.includes(option.value)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 주 수업횟수 - 자동 계산 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">주 수업횟수</label>
              <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                주 {formData.weekly_count}회
              </div>
            </div>

            {/* 등록일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">등록일</label>
              <input
                type="date"
                value={formData.enrollment_date || ''}
                onChange={(e) => handleChange('enrollment_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 시즌 등록 (고3, N수 학생만 표시, 신규 등록 시에만) */}
      {isSeasonTarget && mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
              시즌 등록
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {seasonsLoading ? (
              <div className="flex items-center text-gray-500 py-4">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                시즌 정보 로딩 중...
              </div>
            ) : availableSeasons.length === 0 ? (
              <div className="text-gray-500 py-4">
                현재 진행중인 시즌이 없습니다.
              </div>
            ) : (
              <>
                {/* 시즌 등록 체크박스 */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enrollInSeason"
                    checked={enrollInSeason}
                    onChange={(e) => {
                      setEnrollInSeason(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedSeasonId(null);
                      }
                    }}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="enrollInSeason" className="text-sm font-medium text-gray-700">
                    시즌에 함께 등록하기
                  </label>
                </div>

                {/* 시즌 선택 */}
                {enrollInSeason && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        등록할 시즌 선택
                      </label>
                      <select
                        value={selectedSeasonId || ''}
                        onChange={(e) => setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">시즌을 선택하세요</option>
                        {availableSeasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.season_name} ({SEASON_TYPE_LABELS[season.season_type]}) - {formatSeasonFee(season.default_season_fee)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedSeasonId && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                        <p>학생 등록 완료 후 시즌 등록 페이지에서 상세 설정이 가능합니다.</p>
                        <p className="mt-1 text-xs text-yellow-600">
                          (등록일이 시즌 시작일 이후인 경우 시즌비가 자동으로 일할계산됩니다)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 학원비 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>학원비 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 월 학원비 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                월 학원비 <span className="text-gray-500 text-xs">(수업횟수에 따라 자동 설정)</span>
              </label>
              <input
                type="number"
                value={formData.monthly_tuition}
                onChange={(e) => handleChange('monthly_tuition', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                step="10000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 할인율 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">할인율 (%)</label>
              <input
                type="number"
                value={formData.discount_rate || 0}
                onChange={(e) => handleChange('discount_rate', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                max="100"
                step="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 납부일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                납부일 <span className="text-gray-500 text-xs">(비워두면 학원 기본값 사용)</span>
              </label>
              <select
                value={formData.payment_due_day || ''}
                onChange={(e) => handleChange('payment_due_day', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">학원 기본값 ({academySettings.tuition_due_day || 5}일)</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    매월 {day}일
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 할인 사유 - 할인율이 있을 때만 표시 */}
          {(formData.discount_rate || 0) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                할인 사유 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.discount_reason || ''}
                onChange={(e) => handleChange('discount_reason', e.target.value)}
                placeholder="예: 형제자매 할인, 장기등록 할인, 추천인 할인 등"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.discount_reason ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.discount_reason && <p className="text-red-500 text-sm mt-1">{errors.discount_reason}</p>}
            </div>
          )}

          {/* 실납부액 표시 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">월 학원비</span>
              <span className="font-medium">{formatCurrency(formData.monthly_tuition || 0)}</span>
            </div>
            {(formData.discount_rate || 0) > 0 && (
              <div className="flex justify-between items-center text-red-600 mt-2">
                <span>할인 ({formData.discount_rate}%)</span>
                <span>-{formatCurrency(Math.round((formData.monthly_tuition || 0) * ((formData.discount_rate || 0) / 100)))}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
              <span className="font-semibold text-gray-900">실납부액</span>
              <span className="font-bold text-lg text-primary-600">{formatCurrency(finalTuition)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 추가 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>추가 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="서울시 강남구..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">메모</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="특이사항이나 메모를 입력하세요..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 상태 (수정 모드일 때만) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const newStatus = e.target.value as StudentStatus;
                  handleChange('status', newStatus);
                  // 휴원이 아닌 상태로 변경 시 휴식 정보 초기화
                  if (newStatus !== 'paused') {
                    handleChange('rest_start_date', '');
                    handleChange('rest_end_date', '');
                    handleChange('rest_reason', '');
                    setIsIndefiniteRest(false);
                  } else if (!formData.rest_start_date) {
                    // 휴원으로 변경 시 기본값으로 오늘 날짜 설정
                    handleChange('rest_start_date', new Date().toISOString().split('T')[0]);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 휴식 설정 (휴원 상태일 때만 표시) */}
          {mode === 'edit' && formData.status === 'paused' && (
            <div className="col-span-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
              <h4 className="font-medium text-yellow-800 flex items-center gap-2">
                <span className="text-lg">⏸️</span> 휴식 설정
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {/* 휴식 시작일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    휴식 시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.rest_start_date || ''}
                    onChange={(e) => handleChange('rest_start_date', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>

                {/* 휴식 종료일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    휴식 종료일
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={formData.rest_end_date || ''}
                      onChange={(e) => handleChange('rest_end_date', e.target.value)}
                      disabled={isIndefiniteRest}
                      className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                        isIndefiniteRest ? 'bg-gray-100 text-gray-400' : ''
                      }`}
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isIndefiniteRest}
                      onChange={(e) => {
                        setIsIndefiniteRest(e.target.checked);
                        if (e.target.checked) {
                          handleChange('rest_end_date', '');
                        }
                      }}
                      className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    무기한 휴식
                  </label>
                </div>
              </div>

              {/* 휴식 사유 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">휴식 사유</label>
                <input
                  type="text"
                  value={formData.rest_reason || ''}
                  onChange={(e) => handleChange('rest_reason', e.target.value)}
                  placeholder="예: 개인 사정, 부상, 여행 등"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <p className="text-xs text-yellow-700">
                💡 휴식 기간 동안 학원비 이월/환불 처리는 학생 상세 페이지에서 별도로 진행할 수 있습니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{errors.submit}</p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : mode === 'create' ? '등록' : '수정'}
        </Button>
      </div>
    </form>
  );
}
