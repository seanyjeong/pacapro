'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import type { SeasonFormData, SeasonType, SeasonStatus, ContinuousDiscountType, TimeSlot, GradeTimeSlots } from '@/lib/types/season';
import { OPERATING_DAY_OPTIONS, SEASON_TARGET_GRADES, TIME_SLOT_OPTIONS } from '@/lib/types/season';

export default function NewSeasonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState<SeasonFormData>({
    season_name: '',
    season_type: 'early',
    year: currentYear,
    start_date: '',
    end_date: '',
    non_season_end_date: '',
    operating_days: [1, 2, 3, 4, 5, 6], // 월~토 기본
    grade_time_slots: { '고3': ['evening'], 'N수': ['morning'] }, // 기본값: 고3 저녁, N수 오전
    season_fee: 0,
    continuous_discount_type: 'none',
    continuous_discount_rate: 0,
    status: 'draft',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.season_name.trim()) {
      setError('시즌명을 입력해주세요.');
      return;
    }
    if (!formData.start_date) {
      setError('시즌 시작일을 입력해주세요.');
      return;
    }
    if (!formData.end_date) {
      setError('시즌 종료일을 입력해주세요.');
      return;
    }
    if (formData.operating_days.length === 0) {
      setError('운영 요일을 하나 이상 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await seasonsApi.createSeason(formData);
      router.push('/seasons');
    } catch (err) {
      setError(err instanceof Error ? err.message : '시즌 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof SeasonFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleOperatingDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      operating_days: prev.operating_days.includes(day)
        ? prev.operating_days.filter(d => d !== day)
        : [...prev.operating_days, day].sort((a, b) => a - b),
    }));
  };

  const toggleGradeTimeSlot = (grade: string, timeSlot: TimeSlot) => {
    setFormData(prev => {
      const currentSlots = prev.grade_time_slots?.[grade] || [];
      const newSlots = currentSlots.includes(timeSlot)
        ? currentSlots.filter(s => s !== timeSlot)
        : [...currentSlots, timeSlot];
      return {
        ...prev,
        grade_time_slots: {
          ...prev.grade_time_slots,
          [grade]: newSlots,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시즌 등록</h1>
          <p className="text-gray-600">새로운 시즌(수시/정시)을 등록합니다</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>시즌 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* 시즌명 & 연도 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="예: 2025 수시 시즌, 2026 정시 시즌"
                  value={formData.season_name}
                  onChange={e => handleChange('season_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.year}
                  onChange={e => handleChange('year', parseInt(e.target.value))}
                >
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 시즌 타입 & 상태 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시즌 타입</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.season_type}
                  onChange={e => handleChange('season_type', e.target.value as SeasonType)}
                >
                  <option value="early">수시</option>
                  <option value="regular">정시</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.status}
                  onChange={e => handleChange('status', e.target.value as SeasonStatus)}
                >
                  <option value="draft">준비중</option>
                  <option value="active">진행중</option>
                  <option value="completed">종료</option>
                </select>
              </div>
            </div>

            {/* 날짜 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비시즌 종강일
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.non_season_end_date || ''}
                  onChange={e => handleChange('non_season_end_date', e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">일할계산 기준일</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌 시작일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.start_date}
                  onChange={e => handleChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌 종료일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={formData.end_date}
                  onChange={e => handleChange('end_date', e.target.value)}
                />
              </div>
            </div>

            {/* 운영 요일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                운영 요일 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {OPERATING_DAY_OPTIONS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.operating_days.includes(day.value)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleOperatingDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 학년별 시간대 설정 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">학년별 수업 시간대</h3>
              <p className="text-xs text-gray-500 mb-4">고3, N수 학생의 수업 시간대를 각각 설정합니다. 여러 시간대를 선택할 수 있습니다.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SEASON_TARGET_GRADES.map(grade => (
                  <div key={grade} className="flex items-center space-x-3">
                    <label className="block text-sm font-medium text-gray-700 w-16">{grade}</label>
                    <div className="flex-1 flex gap-2">
                      {TIME_SLOT_OPTIONS.map(slot => {
                        const isSelected = formData.grade_time_slots?.[grade]?.includes(slot.value);
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleGradeTimeSlot(grade, slot.value)}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 시즌비 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기본 시즌비 (원)
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="0"
                value={formData.season_fee || ''}
                onChange={e => handleChange('season_fee', e.target.value === '' ? 0 : parseInt(e.target.value))}
                min="0"
                step="10000"
              />
              <p className="text-xs text-gray-500 mt-1">1만원 단위</p>
            </div>

            {/* 연속등록 할인 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">연속등록 할인 (수시→정시)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">할인 타입</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={formData.continuous_discount_type}
                    onChange={e => handleChange('continuous_discount_type', e.target.value as ContinuousDiscountType)}
                  >
                    <option value="none">없음</option>
                    <option value="free">무료</option>
                    <option value="rate">할인율 적용</option>
                  </select>
                </div>
                {formData.continuous_discount_type === 'rate' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">할인율 (%)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="0"
                      value={formData.continuous_discount_rate || ''}
                      onChange={e => handleChange('continuous_discount_rate', e.target.value === '' ? 0 : parseInt(e.target.value))}
                      min="0"
                      max="100"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="시즌에 대한 메모를 입력하세요 (선택)"
                value={formData.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                등록
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
