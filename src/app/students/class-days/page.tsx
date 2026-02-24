'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Calendar, X, AlertCircle, Filter } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { WEEKDAY_OPTIONS, WEEKDAY_MAP, formatClassDays } from '@/lib/types/student';
import type { ClassDaysStudent, ClassDaySlot } from '@/lib/types/student';
import { parseClassDaysWithSlots, extractDayNumbers, formatClassDaysWithSlots } from '@/lib/utils/student-helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 적용 시작월 옵션 생성
function getEffectiveMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [
    { value: 'immediate', label: '즉시 적용 (이번 달)' },
  ];

  // 다음 달부터 6개월 옵션
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const value = `${year}-${String(month).padStart(2, '0')}-01`;
    options.push({
      value,
      label: `${year}년 ${month}월부터`,
    });
  }

  return options;
}

// 학생별 수정 상태
interface StudentEdit {
  class_days: ClassDaySlot[];
  changed: boolean;
}

export default function ClassDaysPage() {
  const [students, setStudents] = useState<ClassDaysStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('immediate');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Map<number, StudentEdit>>(new Map());
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterWeekly, setFilterWeekly] = useState<string>('all');

  const monthOptions = getEffectiveMonthOptions();

  // Grade sort order
  const GRADE_ORDER_MAP: Record<string, number> = { "고1": 1, "고2": 2, "고3": 3, "N수": 4 };

  const filteredStudents = useMemo(() => students
    .filter(s => {
      if (filterGrade !== "all" && s.grade !== filterGrade) return false;
      if (filterWeekly !== "all" && s.weekly_count !== Number(filterWeekly)) return false;
      return true;
    })
    .sort((a, b) => {
      const ga = GRADE_ORDER_MAP[a.grade || ""] ?? 99;
      const gb = GRADE_ORDER_MAP[b.grade || ""] ?? 99;
      if (ga !== gb) return ga - gb;
      return a.name.localeCompare(b.name, "ko");
    }), [students, filterGrade, filterWeekly]);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await studentsAPI.getClassDays();
      setStudents(res.students);
      setEdits(new Map());
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to fetch class days:', error);
      toast.error('수업일 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 요일 토글
  const toggleDay = (studentId: number, dayValue: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentEdit = edits.get(studentId);
    const defaultTimeSlot = student.time_slot || 'evening';
    const currentSlots = currentEdit
      ? currentEdit.class_days
      : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const currentDayNums = extractDayNumbers(currentSlots);

    let newSlots: ClassDaySlot[];
    if (currentDayNums.includes(dayValue)) {
      newSlots = currentSlots.filter(s => s.day !== dayValue);
    } else {
      newSlots = [...currentSlots, { day: dayValue, timeSlot: defaultTimeSlot }].sort((a, b) => a.day - b.day);
    }

    // 원래 값과 비교하여 변경 여부 판단
    const originalSlots = parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const originalDayNums = new Set(extractDayNumbers(originalSlots));
    const newDayNums = new Set(extractDayNumbers(newSlots));
    const daysChanged = originalDayNums.size !== newDayNums.size ||
      [...originalDayNums].some(d => !newDayNums.has(d));
    const timeSlotsChanged = !daysChanged && newSlots.some(ns => {
      const os = originalSlots.find(o => o.day === ns.day);
      return os && os.timeSlot !== ns.timeSlot;
    });

    setEdits(prev => {
      const next = new Map(prev);
      if (daysChanged || timeSlotsChanged) {
        next.set(studentId, { class_days: newSlots, changed: true });
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  // 요일별 시간대 변경
  const changeDayTimeSlot = (studentId: number, dayValue: number, timeSlot: 'morning' | 'afternoon' | 'evening') => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentEdit = edits.get(studentId);
    const defaultTimeSlot = student.time_slot || 'evening';
    const currentSlots = currentEdit
      ? currentEdit.class_days
      : parseClassDaysWithSlots(student.class_days, defaultTimeSlot);

    const newSlots = currentSlots.map(s => s.day === dayValue ? { ...s, timeSlot } : s);

    // 원래 값과 비교
    const originalSlots = parseClassDaysWithSlots(student.class_days, defaultTimeSlot);
    const changed = newSlots.some(ns => {
      const os = originalSlots.find(o => o.day === ns.day);
      return !os || os.timeSlot !== ns.timeSlot;
    }) || newSlots.length !== originalSlots.length;

    setEdits(prev => {
      const next = new Map(prev);
      if (changed) {
        next.set(studentId, { class_days: newSlots, changed: true });
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  // 전체 선택
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // 개별 선택
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 저장 (변경된 항목만)
  const handleSave = async () => {
    const changedStudents = Array.from(edits.entries())
      .filter(([, edit]) => edit.changed)
      .map(([id, edit]) => ({
        id,
        class_days: edit.class_days,
      }));

    if (changedStudents.length === 0) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }

    try {
      setSaving(true);
      const effective = effectiveFrom === 'immediate' ? null : effectiveFrom;
      const res = await studentsAPI.bulkUpdateClassDays({
        effective_from: effective,
        students: changedStudents,
      });

      toast.success(res.message);
      await fetchStudents();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 예약 취소
  const handleCancelSchedule = async (studentId: number) => {
    try {
      await studentsAPI.cancelClassDaysSchedule(studentId);
      toast.success('예약된 변경이 취소되었습니다.');
      await fetchStudents();
    } catch (error) {
      console.error('Cancel failed:', error);
      toast.error('예약 취소에 실패했습니다.');
    }
  };

  // 변경된 학생 수
  const changedCount = Array.from(edits.values()).filter(e => e.changed).length;

  // 예약 변경 있는 학생 수
  const scheduledCount = students.filter(s => s.class_days_next !== null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">수업일 관리</h1>
          <p className="text-muted-foreground mt-1">
            재원생 {students.length}명의 수업 요일을 관리합니다.
          </p>
        </div>
      </div>

      {/* 컨트롤 바 */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">적용 시작월:</span>
              <Select value={effectiveFrom} onValueChange={setEffectiveFrom}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              {changedCount > 0 && (
                <Badge variant="secondary">
                  {changedCount}명 변경됨
                </Badge>
              )}
              {scheduledCount > 0 && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {scheduledCount}명 변경 예정
                </Badge>
              )}
              <Button
                onClick={handleSave}
                disabled={changedCount === 0 || saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                저장 ({changedCount}명)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue placeholder="학년" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 학년</SelectItem>
              <SelectItem value="고1">고1</SelectItem>
              <SelectItem value="고2">고2</SelectItem>
              <SelectItem value="고3">고3</SelectItem>
              <SelectItem value="N수">N수</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterWeekly} onValueChange={setFilterWeekly}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue placeholder="수업 횟수" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 횟수</SelectItem>
              <SelectItem value="1">주1회</SelectItem>
              <SelectItem value="2">주2회</SelectItem>
              <SelectItem value="3">주3회</SelectItem>
              <SelectItem value="4">주4회</SelectItem>
              <SelectItem value="5">주5회</SelectItem>
              <SelectItem value="6">주6회</SelectItem>
            </SelectContent>
          </Select>
          {(filterGrade !== 'all' || filterWeekly !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setFilterGrade('all'); setFilterWeekly('all'); }}>
              초기화
            </Button>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{filteredStudents.length}명</span>
      </div>

      {/* 학생 목록 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-medium">이름</th>
                  <th className="p-3 text-left text-sm font-medium">학년</th>
                  <th className="p-3 text-left text-sm font-medium">현재 수업일</th>
                  <th className="p-3 text-center text-sm font-medium">수업일 변경</th>
                  <th className="p-3 text-left text-sm font-medium">변경 예정</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => {
                  const edit = edits.get(student.id);
                  const defaultTS = student.time_slot || 'evening';
                  const currentSlots = edit
                    ? edit.class_days
                    : parseClassDaysWithSlots(student.class_days, defaultTS);
                  const currentDayNums = extractDayNumbers(currentSlots);
                  const originalDayNums = extractDayNumbers(parseClassDaysWithSlots(student.class_days, defaultTS));
                  const hasChange = edit?.changed;
                  const hasScheduled = student.class_days_next !== null;

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        'border-b hover:bg-muted/30 transition-colors',
                        hasChange && 'bg-blue-50/50 dark:bg-blue-950/20',
                      )}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => toggleSelect(student.id)}
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{student.name}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{student.grade || '-'}</Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">
                          {formatClassDaysWithSlots(student.class_days, defaultTS)} (주{student.weekly_count}회)
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-center gap-1">
                            {WEEKDAY_OPTIONS.map(opt => {
                              const isActive = currentDayNums.includes(opt.value);
                              const wasOriginal = originalDayNums.includes(opt.value);
                              const isChanged = isActive !== wasOriginal;

                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => toggleDay(student.id, opt.value)}
                                  className={cn(
                                    'w-8 h-8 rounded-md text-xs font-medium transition-all',
                                    'border',
                                    isActive
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background text-muted-foreground border-input hover:border-primary/50',
                                    isChanged && isActive && 'ring-2 ring-blue-400',
                                    isChanged && !isActive && 'ring-2 ring-red-300 border-red-300',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                            {hasChange && (
                              <button
                                onClick={() => {
                                  setEdits(prev => {
                                    const next = new Map(prev);
                                    next.delete(student.id);
                                    return next;
                                  });
                                }}
                                className="ml-1 text-muted-foreground hover:text-foreground"
                                title="변경 취소"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {/* 선택된 요일별 시간대 선택 */}
                          {currentSlots.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                              {currentSlots.map(slot => (
                                <select
                                  key={slot.day}
                                  value={slot.timeSlot}
                                  onChange={(e) => changeDayTimeSlot(student.id, slot.day, e.target.value as 'morning' | 'afternoon' | 'evening')}
                                  className="text-[10px] bg-background border border-input rounded px-1 py-0.5"
                                  title={`${WEEKDAY_MAP[slot.day]} 시간대`}
                                >
                                  <option value="morning">{WEEKDAY_MAP[slot.day]}오전</option>
                                  <option value="afternoon">{WEEKDAY_MAP[slot.day]}오후</option>
                                  <option value="evening">{WEEKDAY_MAP[slot.day]}저녁</option>
                                </select>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {hasScheduled ? (
                          <div className="flex items-center gap-2">
                            <div className="text-sm">
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                {formatClassDaysWithSlots(student.class_days_next!, defaultTS)}
                              </Badge>
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({student.class_days_effective_from?.slice(0, 7)}~)
                              </span>
                            </div>
                            <button
                              onClick={() => handleCancelSchedule(student.id)}
                              className="text-red-500 hover:text-red-700"
                              title="예약 취소"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : hasChange ? (
                          <Badge variant="secondary" className="text-blue-600">
                            {formatClassDaysWithSlots(currentSlots)} (주{currentSlots.length}회)
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      재원 중인 학생이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
