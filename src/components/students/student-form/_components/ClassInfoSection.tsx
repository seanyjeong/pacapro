'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData } from '@/lib/types/student';
import { WEEKDAY_OPTIONS } from '@/lib/types/student';
import { extractDayNumbers, parseClassDaysWithSlots } from '@/lib/utils/student-helpers';
import type { Student } from '@/lib/types/student';

interface ClassInfoSectionProps {
  mode: 'create' | 'edit';
  formData: StudentFormData;
  initialData?: Student;
  classDaysChanged: boolean;
  effectiveFrom: string;
  setEffectiveFrom: (v: string) => void;
  effectiveMonthOptions: { value: string; label: string }[];
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
  handleClassDayToggle: (day: number) => void;
  handleDayTimeSlotChange: (day: number, timeSlot: 'morning' | 'afternoon' | 'evening') => void;
}

export function ClassInfoSection({
  mode, formData, initialData, classDaysChanged,
  effectiveFrom, setEffectiveFrom, effectiveMonthOptions,
  handleChange, handleClassDayToggle, handleDayTimeSlotChange,
}: ClassInfoSectionProps) {
  return (
    <Card>
      <CardHeader><CardTitle>수업 정보</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* 수업요일 + 시간대 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            수업요일 <span className="text-muted-foreground text-xs">(선택하면 주 수업횟수가 자동 계산됩니다)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((option) => {
              const isSelected = extractDayNumbers(formData.class_days).includes(option.value);
              return (
                <button key={option.value} type="button"
                  onClick={() => handleClassDayToggle(option.value)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary'
                  }`}>
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* 요일별 시간대 설정 */}
          {formData.class_days.length > 0 && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">요일별 시간대 설정</label>
              <div className="flex flex-wrap gap-2">
                {formData.class_days.map((slot) => {
                  const dayLabel = WEEKDAY_OPTIONS.find(o => o.value === slot.day)?.label || '';
                  return (
                    <div key={slot.day} className="flex items-center gap-1 bg-muted rounded-lg px-3 py-1.5">
                      <span className="text-sm font-medium min-w-[1.5rem]">{dayLabel}</span>
                      <select value={slot.timeSlot}
                        onChange={(e) => handleDayTimeSlotChange(slot.day, e.target.value as 'morning' | 'afternoon' | 'evening')}
                        className="text-xs bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="morning">오전</option>
                        <option value="afternoon">오후</option>
                        <option value="evening">저녁</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 예약 변경 알림 (수정 모드에서만) */}
          {mode === 'edit' && initialData?.class_days_next && initialData?.class_days_effective_from && !classDaysChanged && (
            <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                변경 예정: {(() => {
                  const nextSlots = parseClassDaysWithSlots(initialData.class_days_next, initialData.time_slot || 'evening');
                  const dayMap: Record<number, string> = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };
                  const timeMap: Record<string, string> = { morning: '오전', afternoon: '오후', evening: '저녁' };
                  return nextSlots.map(s => `${dayMap[s.day] || ''}(${timeMap[s.timeSlot] || s.timeSlot})`).join(', ') || '-';
                })()} ({initialData.class_days_effective_from?.slice(0, 7)}부터)
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                여기서 수업요일을 직접 수정하면 예약 변경은 취소됩니다.
              </p>
            </div>
          )}

          {/* 적용 시작월 선택 (수정 모드에서 수업요일 변경 시) */}
          {mode === 'edit' && classDaysChanged && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">적용 시작월</label>
              <select value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full sm:w-[220px] bg-background border border-border rounded-lg px-3 py-2 text-sm">
                {effectiveMonthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {effectiveFrom === 'immediate' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">즉시 적용하면 출석부에 바로 반영됩니다.</p>
              )}
              {effectiveFrom !== 'immediate' && (
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">선택한 달부터 수업요일이 변경됩니다. 현재 수업요일은 유지됩니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 기본 시간대 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            기본 시간대 <span className="text-muted-foreground text-xs">(새 요일 추가 시 기본값)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'morning', label: '오전' },
              { value: 'afternoon', label: '오후' },
              { value: 'evening', label: '저녁' },
            ].map((slot) => (
              <button key={slot.value} type="button"
                onClick={() => handleChange('time_slot', slot.value as 'morning' | 'afternoon' | 'evening')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.time_slot === slot.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:border-primary'
                }`}>
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 주 수업횟수 - 읽기 전용 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">주 수업횟수</label>
            <div className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-foreground font-medium">
              주 {formData.weekly_count}회
            </div>
          </div>

          {/* 등록일 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">등록일</label>
            <input type="date" value={formData.enrollment_date || ''}
              onChange={(e) => handleChange('enrollment_date', e.target.value)}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
