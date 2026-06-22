import { Clock, Loader2, Save } from 'lucide-react';
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
  timeOptions: string[];
  saving: boolean;
  onDefaultStartTimeChange: (value: string) => void;
  onDefaultEndTimeChange: (value: string) => void;
  onApplyAll: () => void;
  onApplyWeekdays: () => void;
  onUpdateHour: <K extends keyof WeeklyHour>(dayOfWeek: number, field: K, value: WeeklyHour[K]) => void;
  onSave: () => void;
}

export function WeeklyHoursSection({
  weeklyHours,
  defaultStartTime,
  defaultEndTime,
  timeOptions,
  saving,
  onDefaultStartTimeChange,
  onDefaultEndTimeChange,
  onApplyAll,
  onApplyWeekdays,
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
