'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, X, Trophy, Users } from 'lucide-react';
import { seasonsApi } from '@/lib/api/seasons';
import type { Season, GradeTimeSlots, SeasonTargetGrade } from '@/lib/types/season';
import type { TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_LABELS, WEEKDAY_LABELS } from '@/lib/types/schedule';
import { parseOperatingDays, formatOperatingDays, SEASON_TARGET_GRADES } from '@/lib/types/season';
import apiClient from '@/lib/api/client';

type CreateMode = 'season' | 'student';

interface BulkScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkScheduleModal({ open, onClose, onSuccess }: BulkScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [seasons, setSeasons] = useState<Season[]>([]);

  // Mode - 기본값을 'student'(학생 수업요일 기반)로 설정
  const [mode, setMode] = useState<CreateMode>('student');

  // Form state - Season mode
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedTargetGrade, setSelectedTargetGrade] = useState<SeasonTargetGrade>('고3');
  const [seasonExcludedDates, setSeasonExcludedDates] = useState<Set<string>>(new Set());

  // Form state - Student mode
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Common
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('afternoon');
  // 시즌 모드: 여러 시간대 선택 가능
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<TimeSlot>>(new Set(['afternoon']));

  // Load data
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setDataLoading(true);
      const seasonsData = await seasonsApi.getSeasons({ status: 'active' });
      setSeasons(seasonsData);

      // Auto-select first available
      if (seasonsData.length > 0 && !selectedSeasonId) {
        const firstSeason = seasonsData[0];
        setSelectedSeasonId(firstSeason.id);
        // 학년별 시간대 자동 설정
        if (firstSeason.grade_time_slots) {
          const gradeSlots = (firstSeason.grade_time_slots as GradeTimeSlots)[selectedTargetGrade];
          if (gradeSlots) {
            // 배열이면 그대로, 단일값이면 배열로 변환
            const slots = Array.isArray(gradeSlots) ? gradeSlots : [gradeSlots];
            setSelectedTimeSlots(new Set(slots as TimeSlot[]));
            if (slots.length > 0) {
              setTimeSlot(slots[0] as TimeSlot);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // Calculate season dates
  const seasonTargetDates = useMemo(() => {
    if (!selectedSeasonId) return [];
    const season = seasons.find(s => s.id === selectedSeasonId);
    if (!season) return [];

    const operatingDays = parseOperatingDays(season.operating_days);
    const dates: string[] = [];
    const startDate = new Date(season.season_start_date + 'T00:00:00');
    const endDate = new Date(season.season_end_date + 'T00:00:00');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (operatingDays.includes(dayOfWeek)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(dateStr);
      }
    }
    return dates;
  }, [selectedSeasonId, seasons]);

  const seasonFinalDates = useMemo(() => {
    return seasonTargetDates.filter(d => !seasonExcludedDates.has(d));
  }, [seasonTargetDates, seasonExcludedDates]);

  const toggleTimeSlot = (slot: TimeSlot) => {
    setSelectedTimeSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slot)) {
        // 최소 1개는 선택되어야 함
        if (newSet.size > 1) newSet.delete(slot);
      } else {
        newSet.add(slot);
      }
      return newSet;
    });
  };

  const toggleSeasonExcludedDate = (date: string) => {
    setSeasonExcludedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) newSet.delete(date);
      else newSet.add(date);
      return newSet;
    });
  };

  // 시즌 또는 학년 변경 시 해당 학년의 시간대 자동 설정
  const handleSeasonChange = (seasonId: number | null) => {
    setSelectedSeasonId(seasonId);
    if (seasonId) {
      const season = seasons.find(s => s.id === seasonId);
      if (season?.grade_time_slots) {
        const gradeSlots = (season.grade_time_slots as GradeTimeSlots)[selectedTargetGrade];
        if (gradeSlots) {
          const slots = Array.isArray(gradeSlots) ? gradeSlots : [gradeSlots];
          setSelectedTimeSlots(new Set(slots as TimeSlot[]));
          if (slots.length > 0) {
            setTimeSlot(slots[0] as TimeSlot);
          }
        }
      }
    }
  };

  const handleTargetGradeChange = (grade: SeasonTargetGrade) => {
    setSelectedTargetGrade(grade);
    if (selectedSeasonId) {
      const season = seasons.find(s => s.id === selectedSeasonId);
      if (season?.grade_time_slots) {
        const gradeSlots = (season.grade_time_slots as GradeTimeSlots)[grade];
        if (gradeSlots) {
          const slots = Array.isArray(gradeSlots) ? gradeSlots : [gradeSlots];
          setSelectedTimeSlots(new Set(slots as TimeSlot[]));
          if (slots.length > 0) {
            setTimeSlot(slots[0] as TimeSlot);
          }
        }
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      let requestBody: Record<string, unknown>;

      if (mode === 'student') {
        // 학생 수업요일 기반 생성
        requestBody = {
          mode: 'student',
          year,
          month,
          time_slot: timeSlot,
        };
      } else {
        // season 모드
        if (!selectedSeasonId) {
          setError('시즌을 선택해주세요.');
          return;
        }
        if (!selectedTargetGrade) {
          setError('대상 학년을 선택해주세요.');
          return;
        }
        if (seasonFinalDates.length === 0) {
          setError('생성할 수업이 없습니다.');
          return;
        }
        if (selectedTimeSlots.size === 0) {
          setError('시간대를 하나 이상 선택해주세요.');
          return;
        }
        requestBody = {
          mode: 'season',
          season_id: selectedSeasonId,
          target_grade: selectedTargetGrade,
          excluded_dates: Array.from(seasonExcludedDates),
          time_slots: Array.from(selectedTimeSlots),  // 복수 시간대
        };
      }

      const result = await apiClient.post<{
        created_count: number;
        skipped_count: number;
      }>('/schedules/bulk', requestBody);

      toast.success(`${result.created_count}개의 수업이 생성되었습니다.`, {
        description: result.skipped_count > 0 ? `${result.skipped_count}개 스킵됨` : undefined,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '일괄 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSeasonExcludedDates(new Set());
    onClose();
  };

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>일괄 수업 생성</DialogTitle>
          <DialogDescription>
            학생 수업일 또는 시즌을 기반으로 수업을 한번에 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 px-2">
          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 모드 선택 탭 */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              className={`flex items-center px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                mode === 'student'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setMode('student')}
            >
              <Users className="w-4 h-4 mr-2" />
              학생 수업일
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                추천
              </span>
            </button>
            <button
              type="button"
              className={`flex items-center px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                mode === 'season'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setMode('season')}
            >
              <Trophy className="w-4 h-4 mr-2" />
              시즌 기반
            </button>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              로딩 중...
            </div>
          ) : (
            <div className="space-y-6">
              {/* 학생 수업일 모드 - 학생들의 수업요일을 자동으로 조회하여 해당 날짜에 스케줄 생성 */}
              {mode === 'student' && (
                <>
                  <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p className="font-medium mb-1">📅 학생 수업일 기반 자동 생성</p>
                    <p>등록된 학생들의 수업요일을 자동으로 조회하여 해당 월의 스케줄을 생성합니다.</p>
                  </div>

                  {/* 년/월 선택 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        연도 <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={year}
                        onChange={e => setYear(parseInt(e.target.value))}
                      >
                        {[year - 1, year, year + 1].map(y => (
                          <option key={y} value={y}>{y}년</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        월 <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={month}
                        onChange={e => setMonth(parseInt(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}월</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 시간대 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기본 시간대
                    </label>
                    <div className="flex gap-2">
                      {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map(slot => (
                        <button
                          key={slot}
                          type="button"
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            timeSlot === slot
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setTimeSlot(slot)}
                        >
                          {TIME_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 시즌 모드 */}
              {mode === 'season' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시즌 선택 <span className="text-red-500">*</span>
                    </label>
                    {seasons.length === 0 ? (
                      <div className="text-gray-500 text-sm p-4 bg-gray-50 rounded-md">
                        활성화된 시즌이 없습니다. 시즌을 먼저 등록해주세요.
                      </div>
                    ) : (
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={selectedSeasonId || ''}
                        onChange={e => handleSeasonChange(e.target.value ? parseInt(e.target.value) : null)}
                      >
                        {seasons.map(season => (
                          <option key={season.id} value={season.id}>
                            {season.season_name} ({season.season_start_date} ~ {season.season_end_date})
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedSeason && (
                      <p className="text-xs text-gray-500 mt-1">
                        운영요일: {formatOperatingDays(parseOperatingDays(selectedSeason.operating_days))}
                      </p>
                    )}
                  </div>

                  {/* 대상 학년 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      대상 학년 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {SEASON_TARGET_GRADES.map(grade => (
                        <button
                          key={grade}
                          type="button"
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            selectedTargetGrade === grade
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => handleTargetGradeChange(grade)}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 시간대 선택 (복수 선택 가능) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시간대 <span className="text-red-500">*</span>
                      <span className="text-gray-500 font-normal ml-2">(복수 선택 가능)</span>
                    </label>
                    <div className="flex gap-2">
                      {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map(slot => (
                        <button
                          key={slot}
                          type="button"
                          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            selectedTimeSlots.has(slot)
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => toggleTimeSlot(slot)}
                        >
                          {TIME_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      선택된 시간대: {Array.from(selectedTimeSlots).map(s => TIME_SLOT_LABELS[s]).join(', ')}
                    </p>
                  </div>
                </>
              )}

              {/* 날짜 미리보기 (시즌 모드만) */}
              {mode === 'season' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생성될 수업 날짜 ({seasonFinalDates.length}개)
                    <span className="text-gray-500 font-normal ml-2">클릭하여 제외</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {seasonTargetDates.length === 0 ? (
                      <div className="text-gray-500 text-sm">
                        시즌을 선택해주세요.
                      </div>
                    ) : (
                    <div className="flex flex-wrap gap-2">
                      {seasonTargetDates.map(date => {
                        const isExcluded = seasonExcludedDates.has(date);
                        const d = new Date(date + 'T00:00:00');
                        const dayLabel = WEEKDAY_LABELS[d.getDay()];
                        return (
                          <button
                            key={date}
                            type="button"
                            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                              isExcluded
                                ? 'bg-gray-100 text-gray-400 line-through'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                            onClick={() => toggleSeasonExcludedDate(date)}
                          >
                            {date.slice(5)} ({dayLabel})
                            {isExcluded && <X className="w-3 h-3 inline ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>
                </div>
              )}

              {/* 요약 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">요약</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {mode === 'student' ? (
                    <>
                      <li>모드: 학생 수업요일 기반 자동 생성</li>
                      <li>기간: {year}년 {month}월</li>
                      <li>요일: 학생들의 수업요일 자동 조회</li>
                      <li>시간대: {TIME_SLOT_LABELS[timeSlot]}</li>
                    </>
                  ) : (
                    <>
                      <li>시즌: {selectedSeason?.season_name || '미선택'}</li>
                      <li>대상 학년: {selectedTargetGrade}</li>
                      <li>기간: {selectedSeason ? `${selectedSeason.season_start_date} ~ ${selectedSeason.season_end_date}` : '-'}</li>
                      <li>운영요일: {selectedSeason ? formatOperatingDays(parseOperatingDays(selectedSeason.operating_days)) : '-'}</li>
                      <li>시간대: {Array.from(selectedTimeSlots).map(s => TIME_SLOT_LABELS[s]).join(', ')}</li>
                      <li>생성 수업: {seasonFinalDates.length}일 × {selectedTimeSlots.size}타임 = <strong>{seasonFinalDates.length * selectedTimeSlots.size}개</strong></li>
                      {seasonExcludedDates.size > 0 && <li>제외: {seasonExcludedDates.size}일</li>}
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (mode === 'season' && seasonFinalDates.length === 0)}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'season'
              ? `${seasonFinalDates.length * selectedTimeSlots.size}개 수업 생성`
              : '수업 생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
