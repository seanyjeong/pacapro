import { Clock } from 'lucide-react';
import { CLASS_TIME_FIELDS } from './settings-constants';
import { SettingsSectionCard } from './settings-section-card';
import { TimeRangeSelect } from './time-range-select';
import type { AcademySettings, ClassTimeKey, TimeRangePart } from './settings-types';

interface ClassTimeCardProps {
  settings: AcademySettings;
  updateClassTime: (key: ClassTimeKey, part: TimeRangePart, value: string) => void;
}

export function ClassTimeCard({ settings, updateClassTime }: ClassTimeCardProps) {
  return (
    <SettingsSectionCard id="class-times" title="수업 시간대" description="반별 기본 시작/종료 시간" icon={Clock}>
      <div className="grid gap-3 md:grid-cols-3">
        {CLASS_TIME_FIELDS.map((field) => (
          <TimeRangeSelect
            key={field.key}
            label={field.label}
            value={settings[field.key]}
            tone={field.tone}
            onChange={(part, value) => updateClassTime(field.key, part, value)}
          />
        ))}
      </div>
    </SettingsSectionCard>
  );
}
