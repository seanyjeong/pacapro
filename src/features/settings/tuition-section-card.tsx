import { DollarSign } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { WEEKLY_TUITION_FIELDS } from './settings-constants';
import { SettingsSectionCard } from './settings-section-card';
import type { AcademySettings, TuitionKind, WeeklyTuitionKey } from './settings-types';

interface TuitionSectionCardProps {
  kind: TuitionKind;
  title: string;
  description: string;
  settings: AcademySettings;
  updateTuition: (kind: TuitionKind, weeklyKey: WeeklyTuitionKey, value: number) => void;
}

export function TuitionSectionCard({ kind, title, description, settings, updateTuition }: TuitionSectionCardProps) {
  return (
    <SettingsSectionCard title={title} description={description} icon={DollarSign}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {WEEKLY_TUITION_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-center text-sm font-medium text-foreground">{field.label}</label>
            <MoneyInput
              value={settings[kind][field.key]}
              onChange={(value) => updateTuition(kind, field.key, value)}
              className="h-10 text-sm"
            />
          </div>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
