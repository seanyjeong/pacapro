'use client';

/**
 * 일할계산 계산기 모달
 * 설정의 주1~7회 요금표(exam_tuition/adult_tuition)를 가져와
 * 수업 요일 + 등록일 선택 시 첫 달 일할 학원비를 즉시 안내.
 * 반을 고르면 그 반에 따로 정한 학원비 표를, 고르지 않거나 표가 없으면 학원 표를 쓴다.
 * 공식은 backend create.js / update.js 일할계산과 동일 (실수업일 기준, 천원 단위 절삭).
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useBranchTree } from '@/hooks/use-branches';
import { getKoreaDateText } from '@/lib/utils/lifecycle-billing';
import { resolveTuitionTable } from '@/lib/utils/tuition-table';

interface ProrationCalculatorModalProps {
  open: boolean;
  onClose: () => void;
}

type TuitionTable = Record<string, number>;

const DAY_OPTIONS = [
  { num: 1, label: '월' },
  { num: 2, label: '화' },
  { num: 3, label: '수' },
  { num: 4, label: '목' },
  { num: 5, label: '금' },
  { num: 6, label: '토' },
  { num: 0, label: '일' },
];

function getTuitionForWeeklyCount(tuitionTable: TuitionTable, weeklyCount: number) {
  return tuitionTable[String(weeklyCount)] || tuitionTable[`weekly_${weeklyCount}`] || 0;
}

// backend truncateToThousands와 동일 (천원 단위 절삭)
function truncateToThousands(value: number) {
  return Math.floor(value / 1000) * 1000;
}

export function ProrationCalculatorModal({ open, onClose }: ProrationCalculatorModalProps) {
  const [studentType, setStudentType] = useState<'exam' | 'adult'>('exam');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [enrollDate, setEnrollDate] = useState('');
  const [tuitionOverride, setTuitionOverride] = useState<number | null>(null);
  const [examTuition, setExamTuition] = useState<TuitionTable>({});
  const [adultTuition, setAdultTuition] = useState<TuitionTable>({});
  const { branches, enabled: branchesEnabled } = useBranchTree();
  const [classId, setClassId] = useState<number | null>(null);
  const selectedClass = branches.flatMap((branch) => branch.classes).find((item) => item.id === classId) ?? null;

  // 모달 열릴 때 요금표 로드 + 등록일 오늘로 초기화
  useEffect(() => {
    if (!open) return;
    setEnrollDate(getKoreaDateText());
    apiClient
      .get<{ settings: { exam_tuition?: TuitionTable; adult_tuition?: TuitionTable } }>('/settings/academy')
      .then((response) => {
        if (response.settings) {
          setExamTuition(response.settings.exam_tuition || {});
          setAdultTuition(response.settings.adult_tuition || {});
        }
      })
      .catch(() => {
        // 설정이 없으면 수강료 직접 입력으로 사용
      });
  }, [open]);

  const weeklyCount = selectedDays.length;
  const tuitionTable = resolveTuitionTable({ exam_tuition: examTuition, adult_tuition: adultTuition }, studentType, selectedClass?.tuition_by_weekly);
  const autoTuition = weeklyCount > 0 ? getTuitionForWeeklyCount(tuitionTable, weeklyCount) : 0;
  const tuition = tuitionOverride !== null ? tuitionOverride : autoTuition;

  // 구분/반/요일 변경 시 수동 입력값 초기화 → 요금표 자동 반영
  useEffect(() => {
    setTuitionOverride(null);
  }, [studentType, weeklyCount, classId]);

  const toggleDay = (num: number) => {
    setSelectedDays((prev) =>
      prev.includes(num) ? prev.filter((d) => d !== num) : [...prev, num]
    );
  };

  const result = useMemo(() => {
    if (!enrollDate || tuition <= 0) return null;

    const d = new Date(enrollDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const enrollDay = d.getDate();
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const remainingDays = lastDayOfMonth - enrollDay + 1;

    let totalClassDays = 0;
    let classDaysFromEnroll = 0;
    for (let day = 1; day <= lastDayOfMonth; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (selectedDays.includes(dayOfWeek)) {
        totalClassDays++;
        if (day >= enrollDay) classDaysFromEnroll++;
      }
    }

    if (totalClassDays > 0 && classDaysFromEnroll > 0) {
      const amount = truncateToThousands((tuition / totalClassDays) * classDaysFromEnroll);
      return {
        month,
        enrollDay,
        amount,
        detail: `${month}월 수업 ${totalClassDays}회 중 ${enrollDay}일부터 ${classDaysFromEnroll}회`,
        formula: `${tuition.toLocaleString()}원 × (${classDaysFromEnroll}/${totalClassDays}회) = ${amount.toLocaleString()}원`,
      };
    }
    // 수업요일 미선택 시 일수 기준 (backend와 동일 fallback)
    const amount = truncateToThousands((tuition * remainingDays) / lastDayOfMonth);
    return {
      month,
      enrollDay,
      amount,
      detail: `${month}월 ${lastDayOfMonth}일 중 ${enrollDay}일부터 ${remainingDays}일 (일수 기준)`,
      formula: `${tuition.toLocaleString()}원 × (${remainingDays}/${lastDayOfMonth}일) = ${amount.toLocaleString()}원`,
    };
  }, [enrollDate, tuition, selectedDays]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            일할계산 계산기
          </DialogTitle>
          <DialogDescription>
            수업 요일과 등록일을 선택하면 첫 달 학원비를 미리 계산합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 px-6 space-y-4">
          {/* 구분 */}
          <div className="space-y-2">
            <Label>구분</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={studentType === 'exam' ? 'default' : 'outline'}
                onClick={() => setStudentType('exam')}
              >
                수험생
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studentType === 'adult' ? 'default' : 'outline'}
                onClick={() => setStudentType('adult')}
              >
                성인
              </Button>
            </div>
          </div>

          {/* 반 — 지점·반을 쓰는 학원만. 안 고르면 학원 표 */}
          {branchesEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="proration-class">반</Label>
              <select
                id="proration-class"
                value={classId ?? ''}
                onChange={(event) => setClassId(event.target.value ? Number(event.target.value) : null)}
                className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
              >
                <option value="">반 선택 안 함 (학원 기본표)</option>
                {branches.map((branch) => (
                  <optgroup key={branch.id} label={branch.name}>
                    {branch.classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {branch.name} {item.class_name}{item.tuition_by_weekly ? ' · 반 학원비' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedClass ? (
                <p className="text-xs text-muted-foreground">
                  {selectedClass.tuition_by_weekly ? '이 반에 따로 정한 학원비 표로 계산해요.' : '이 반은 학원 기본표를 써요.'}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 수업 요일 */}
          <div className="space-y-2">
            <Label>
              수업 요일
              {weeklyCount > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">주 {weeklyCount}회</span>
              )}
            </Label>
            <div className="flex gap-1.5">
              {DAY_OPTIONS.map((day) => (
                <Button
                  key={day.num}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(day.num) ? 'default' : 'outline'}
                  className="w-9 px-0"
                  onClick={() => toggleDay(day.num)}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 등록일 */}
          <div className="space-y-2">
            <Label>등록일</Label>
            <Input
              type="date"
              value={enrollDate}
              onChange={(e) => setEnrollDate(e.target.value)}
            />
          </div>

          {/* 월 수강료 */}
          <div className="space-y-2">
            <Label>
              월 수강료
              {tuitionOverride === null && autoTuition > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">(요금표 자동)</span>
              )}
            </Label>
            <Input
              type="number"
              step={10000}
              min={0}
              value={tuition || ''}
              onChange={(e) => setTuitionOverride(parseInt(e.target.value) || 0)}
              placeholder="요일 선택 시 요금표에서 자동 입력"
            />
          </div>

          {/* 결과 */}
          {result ? (
            <div className="space-y-1 rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">{result.detail}</p>
              <p className="text-2xl font-bold text-foreground">
                {result.amount.toLocaleString()}원
              </p>
              <p className="text-xs text-muted-foreground">{result.formula} (천원 단위 절삭)</p>
            </div>
          ) : (
            <div className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
              수업 요일과 등록일을 선택하면 일할 금액이 표시됩니다.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
