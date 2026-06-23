import { AlertTriangle, Clock, Loader2, Save, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WeeklyHour } from '@/lib/types/consultation';
import { DAY_ORDER } from '@/lib/types/consultation';
import { timeLabel } from './consultation-settings-utils';
import { WeeklyHourRow } from './weekly-hour-row';

interface WeeklyHoursSectionProps {
  weeklyHours: WeeklyHour[];
  defaultStartTime: string;
  defaultEndTime: string;
  hasSavedWeeklyHours: boolean;
  timeOptions: string[];
  saving: boolean;
  onDefaultStartTimeChange: (value: string) => void;
  onDefaultEndTimeChange: (value: string) => void;
  onApplyAll: () => void;
  onApplyWeekdays: () => void;
  onApplyRecommendedWeekdays: () => void;
  onUpdateHour: <K extends keyof WeeklyHour>(dayOfWeek: number, field: K, value: WeeklyHour[K]) => void;
  onSave: () => void;
}

export function WeeklyHoursSection({
  weeklyHours,
  defaultStartTime,
  defaultEndTime,
  hasSavedWeeklyHours,
  timeOptions,
  saving,
  onDefaultStartTimeChange,
  onDefaultEndTimeChange,
  onApplyAll,
  onApplyWeekdays,
  onApplyRecommendedWeekdays,
  onUpdateHour,
  onSave,
}: WeeklyHoursSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          요일별 운영 시간
        </CardTitle>
        <CardDescription>상담 가능한 요일과 시간을 설정합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasSavedWeeklyHours ? (
          <section
            className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
            data-testid="weekly-hours-recovery-panel"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">빠른 운영시간 복구</h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-100">
                  상담 시간이 비어 있습니다. 우선 평일 10:00-20:00으로 열어두고, 지점 운영에 맞게 조정하세요.
                </p>
                <p className="mt-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
                  권장 시간: 평일 10:00-20:00
                </p>
                <Button className="mt-3 gap-2" size="sm" type="button" variant="outline" onClick={onApplyRecommendedWeekdays}>
                  <Wand2 className="h-4 w-4" />
                  평일 10:00-20:00 적용
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="space-y-3 rounded-md border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">기본 시간 일괄 설정</p>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={defaultStartTime} onValueChange={onDefaultStartTimeChange}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.slice(0, -1).map((time) => (
                  <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>~</span>
            <Select value={defaultEndTime} onValueChange={onDefaultEndTimeChange}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.slice(1).map((time) => (
                  <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={onApplyAll}>전체 적용</Button>
            <Button variant="outline" size="sm" onClick={onApplyWeekdays}>평일만 적용</Button>
          </div>
        </div>

        {DAY_ORDER.map((dayOfWeek) => {
          const hour = weeklyHours.find((item) => item.dayOfWeek === dayOfWeek);
          if (!hour) return null;

          return (
            <WeeklyHourRow
              key={hour.dayOfWeek}
              hour={hour}
              timeOptions={timeOptions}
              onUpdateHour={onUpdateHour}
            />
          );
        })}

        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          운영 시간 저장
        </Button>
      </CardContent>
    </Card>
  );
}
