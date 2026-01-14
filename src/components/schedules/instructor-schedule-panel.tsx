'use client';

/**
 * 강사 근무 일정 배정 패널
 * - 선택된 날짜에 어떤 강사가 오전/오후/저녁 근무하는지 배정
 * - 시급제 강사는 예정 시작/종료 시간 입력
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Calendar,
  Sun,
  Sunrise,
  Moon,
  User,
  Clock,
  Check,
  X,
  Save,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import { toast } from 'sonner';

interface Instructor {
  id: number;
  name: string;
  salary_type: 'hourly' | 'per_class' | 'monthly' | 'mixed';
  hourly_rate?: number;
}

interface ScheduleEntry {
  instructor_id: number;
  instructor_name: string;
  salary_type: string;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
}

interface SchedulesBySlot {
  morning: ScheduleEntry[];
  afternoon: ScheduleEntry[];
  evening: ScheduleEntry[];
}

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const TIME_SLOTS: { slot: TimeSlot; label: string; icon: typeof Sun; color: string; bgColor: string; darkBgColor: string; defaultStart: string; defaultEnd: string }[] = [
  { slot: 'morning', label: '오전', icon: Sunrise, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50', darkBgColor: 'dark:bg-orange-950', defaultStart: '09:00', defaultEnd: '12:00' },
  { slot: 'afternoon', label: '오후', icon: Sun, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50', darkBgColor: 'dark:bg-blue-950', defaultStart: '13:00', defaultEnd: '17:00' },
  { slot: 'evening', label: '저녁', icon: Moon, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50', darkBgColor: 'dark:bg-purple-950', defaultStart: '18:00', defaultEnd: '21:00' },
];

interface InstructorSchedulePanelProps {
  date: string | null;
  onClose?: () => void;
  onRequestExtraDay?: () => void;
  onSave?: () => void;
}

export function InstructorSchedulePanel({ date, onClose, onRequestExtraDay, onSave }: InstructorSchedulePanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [schedules, setSchedules] = useState<SchedulesBySlot>({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [activeSlot, setActiveSlot] = useState<TimeSlot>('morning');

  // 선택된 강사 ID와 시간 정보를 관리
  const [selections, setSelections] = useState<{
    [slot in TimeSlot]: {
      [instructorId: number]: {
        selected: boolean;
        startTime?: string;
        endTime?: string;
      };
    };
  }>({
    morning: {},
    afternoon: {},
    evening: {},
  });

  useEffect(() => {
    if (date) {
      loadSchedules();
    }
  }, [date]);

  const loadSchedules = async () => {
    if (!date) return;

    try {
      setLoading(true);
      const response = await apiClient.get<{
        instructors: Instructor[];
        schedules: SchedulesBySlot;
      }>(`/schedules/date/${date}/instructor-schedules`);

      setInstructors(response.instructors || []);
      setSchedules(response.schedules || { morning: [], afternoon: [], evening: [] });

      // 기존 배정 데이터로 selections 초기화
      const newSelections: typeof selections = {
        morning: {},
        afternoon: {},
        evening: {},
      };

      (['morning', 'afternoon', 'evening'] as TimeSlot[]).forEach((slot) => {
        const slotSchedules = response.schedules?.[slot] || [];
        slotSchedules.forEach((s) => {
          newSelections[slot][s.instructor_id] = {
            selected: true,
            startTime: s.scheduled_start_time || undefined,
            endTime: s.scheduled_end_time || undefined,
          };
        });
      });

      setSelections(newSelections);
    } catch (err) {
      console.error('Failed to load instructor schedules:', err);
      toast.error('강사 일정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstructor = (instructorId: number, instructor: Instructor) => {
    setSelections((prev) => {
      const current = prev[activeSlot][instructorId];
      const slotInfo = TIME_SLOTS.find((s) => s.slot === activeSlot)!;

      if (current?.selected) {
        // 선택 해제
        const { [instructorId]: _, ...rest } = prev[activeSlot];
        return { ...prev, [activeSlot]: rest };
      } else {
        // 선택 - 시급제면 기본 시간 설정
        return {
          ...prev,
          [activeSlot]: {
            ...prev[activeSlot],
            [instructorId]: {
              selected: true,
              startTime: instructor.salary_type === 'hourly' ? slotInfo.defaultStart : undefined,
              endTime: instructor.salary_type === 'hourly' ? slotInfo.defaultEnd : undefined,
            },
          },
        };
      }
    });
  };

  const updateTime = (instructorId: number, field: 'startTime' | 'endTime', value: string) => {
    setSelections((prev) => ({
      ...prev,
      [activeSlot]: {
        ...prev[activeSlot],
        [instructorId]: {
          ...prev[activeSlot][instructorId],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!date) return;

    try {
      setSaving(true);

      // 모든 슬롯의 선택된 강사들을 배열로 변환
      const allSchedules: {
        instructor_id: number;
        time_slot: TimeSlot;
        scheduled_start_time?: string;
        scheduled_end_time?: string;
      }[] = [];

      (['morning', 'afternoon', 'evening'] as TimeSlot[]).forEach((slot) => {
        Object.entries(selections[slot]).forEach(([idStr, data]) => {
          if (data.selected) {
            allSchedules.push({
              instructor_id: parseInt(idStr),
              time_slot: slot,
              scheduled_start_time: data.startTime,
              scheduled_end_time: data.endTime,
            });
          }
        });
      });

      await apiClient.post(`/schedules/date/${date}/instructor-schedules`, {
        schedules: allSchedules,
      });

      toast.success('강사 일정이 저장되었습니다');
      loadSchedules(); // 새로고침
      onSave?.(); // 부모 컴포넌트에 알림
    } catch (err) {
      console.error('Failed to save instructor schedules:', err);
      toast.error('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (!date) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>날짜를 선택하세요</p>
        </CardContent>
      </Card>
    );
  }

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayOfWeek})`;

  const activeSlotInfo = TIME_SLOTS.find((s) => s.slot === activeSlot)!;
  const selectedCount = Object.values(selections[activeSlot]).filter((s) => s.selected).length;
  const totalSelectedCount = Object.values(selections).reduce(
    (sum, slot) => sum + Object.values(slot).filter((s) => s.selected).length,
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="w-5 h-5" />
            강사 근무 배정
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* 타임슬롯 탭 */}
            <div className="flex gap-1.5 overflow-hidden">
              {TIME_SLOTS.map(({ slot, label, icon: Icon, color, bgColor, darkBgColor }) => {
                const count = Object.values(selections[slot]).filter((s) => s.selected).length;
                return (
                  <button
                    key={slot}
                    onClick={() => setActiveSlot(slot)}
                    className={cn(
                      'flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border transition-all whitespace-nowrap text-sm',
                      activeSlot === slot
                        ? `${bgColor} ${darkBgColor} border-current ${color} font-medium`
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 강사 목록 */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {instructors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>등록된 강사가 없습니다</p>
                </div>
              ) : (
                instructors.map((instructor) => {
                  const selection = selections[activeSlot][instructor.id];
                  const isSelected = selection?.selected;
                  const isHourly = instructor.salary_type === 'hourly';

                  return (
                    <div
                      key={instructor.id}
                      className={cn(
                        'p-3 rounded-lg border transition-all overflow-hidden',
                        isSelected
                          ? `${activeSlotInfo.bgColor} ${activeSlotInfo.darkBgColor} border-current`
                          : 'bg-card border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleInstructor(instructor.id, instructor)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                              isSelected ? 'bg-white dark:bg-gray-800' : 'bg-muted'
                            )}
                          >
                            {isSelected ? (
                              <Check className={cn('w-4 h-4', activeSlotInfo.color)} />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{instructor.name}</span>
                            {isHourly && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs bg-orange-50 text-orange-700 border-orange-200"
                              >
                                시급제
                              </Badge>
                            )}
                          </div>
                        </button>
                      </div>

                      {/* 시급제 강사 시간 입력 */}
                      {isSelected && isHourly && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Input
                                type="time"
                                value={selection?.startTime || ''}
                                onChange={(e) => updateTime(instructor.id, 'startTime', e.target.value)}
                                className="w-24 h-8 text-sm shrink-0"
                              />
                              <span className="text-muted-foreground shrink-0">~</span>
                              <Input
                                type="time"
                                value={selection?.endTime || ''}
                                onChange={(e) => updateTime(instructor.id, 'endTime', e.target.value)}
                                className="w-24 h-8 text-sm shrink-0"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 버튼 영역 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                총 {totalSelectedCount}명 배정
              </span>
              <div className="flex gap-2">
                {onRequestExtraDay && (
                  <Button variant="outline" onClick={onRequestExtraDay}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    미배정 출근
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  저장
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
