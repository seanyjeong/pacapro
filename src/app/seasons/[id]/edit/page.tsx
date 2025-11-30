'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import type { SeasonFormData, SeasonType, SeasonStatus, TimeSlot } from '@/lib/types/season';
import { OPERATING_DAY_OPTIONS, SEASON_TARGET_GRADES, TIME_SLOT_OPTIONS, parseOperatingDays } from '@/lib/types/season';
import type { GradeTimeSlots } from '@/lib/types/season';

export default function EditSeasonPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SeasonFormData>({
    season_name: '',
    season_type: 'early',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    non_season_end_date: '',
    operating_days: [],
    grade_time_slots: {},
    season_fee: 0,
    continuous_discount_type: 'none',
    continuous_discount_rate: 0,
    status: 'draft',
  });

  useEffect(() => {
    const fetchSeason = async () => {
      try {
        setLoading(true);
        const response = await seasonsApi.getSeason(seasonId);
        const season = response.season;

        // 백엔드 필드를 폼 필드로 변환
        let gradeTimeSlots = typeof season.grade_time_slots === 'string'
          ? JSON.parse(season.grade_time_slots)
          : season.grade_time_slots;

        // 기존 단일값 형식을 배열 형식으로 변환 (하위 호환성)
        if (gradeTimeSlots) {
          Object.keys(gradeTimeSlots).forEach(grade => {
            if (!Array.isArray(gradeTimeSlots[grade])) {
              gradeTimeSlots[grade] = [gradeTimeSlots[grade]];
            }
          });
        }

        setFormData({
          season_name: season.season_name,
          season_type: season.season_type,
          year: new Date(season.season_start_date).getFullYear(),
          start_date: season.season_start_date,
          end_date: season.season_end_date,
          non_season_end_date: season.non_season_end_date || '',
          operating_days: parseOperatingDays(season.operating_days),
          grade_time_slots: gradeTimeSlots || { '고3': ['evening'], 'N수': ['morning'] },
          season_fee: parseFloat(season.default_season_fee) || 0,
          continuous_discount_type: season.continuous_discount_type || 'none',
          continuous_discount_rate: season.continuous_discount_rate || 0,
          status: season.status,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '시즌 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (seasonId) {
      fetchSeason();
    }
  }, [seasonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.season_name.trim()) {
      setError('시즌명을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await seasonsApi.updateSeason(seasonId, formData);
      router.push(`/seasons/${seasonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '시즌 수정에 실패했습니다.');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시즌 수정</h1>
          <p className="text-gray-600">시즌 정보를 수정합니다</p>
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

            {/* 시즌명 & 타입 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.season_name}
                  onChange={e => handleChange('season_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시즌 타입</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.season_type}
                  onChange={e => handleChange('season_type', e.target.value as SeasonType)}
                >
                  <option value="early">수시</option>
                  <option value="regular">정시</option>
                </select>
              </div>
            </div>

            {/* 날짜 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비시즌 종강일</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.non_season_end_date || ''}
                  onChange={e => handleChange('non_season_end_date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시즌 시작일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.end_date}
                  onChange={e => handleChange('end_date', e.target.value)}
                />
              </div>
            </div>

            {/* 운영 요일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">운영 요일</label>
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

            {/* 학년별 시간대 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">학년별 수업 시간대</h3>
              <p className="text-xs text-gray-500 mb-4">여러 시간대를 선택할 수 있습니다.</p>
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
                시즌비 (원) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="예: 500000"
                value={formData.season_fee}
                onChange={e => handleChange('season_fee', parseInt(e.target.value) || 0)}
                min="0"
                step="10000"
              />
              <p className="text-xs text-gray-500 mt-1">시즌 등록 시 학생이 납부해야 할 금액</p>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.status}
                onChange={e => handleChange('status', e.target.value as SeasonStatus)}
              >
                <option value="draft">준비중</option>
                <option value="upcoming">예정</option>
                <option value="active">진행중</option>
                <option value="ended">종료</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                저장
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
