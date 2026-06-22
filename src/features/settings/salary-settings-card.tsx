import { Banknote } from 'lucide-react';
import { SALARY_DAY_OPTIONS, SALARY_MONTH_TYPE_OPTIONS } from './settings-constants';
import { SalaryExamplePanel } from './salary-example-panel';
import { SettingsSectionCard } from './settings-section-card';
import { SettingsSelect } from './settings-select';
import type { AcademySettings, SalaryMonthType } from './settings-types';
import { cn } from '@/lib/utils/cn';

interface SalarySettingsCardProps {
  settings: AcademySettings;
  updateSetting: <K extends keyof AcademySettings>(key: K, value: AcademySettings[K]) => void;
}

export function SalarySettingsCard({ settings, updateSetting }: SalarySettingsCardProps) {
  return (
    <SettingsSectionCard
      id="salary-settings"
      title="급여 설정"
      description="강사 급여 지급 기준"
      icon={Banknote}
      contentClassName="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsSelect
          label="급여 지급일"
          value={settings.salary_payment_day}
          options={SALARY_DAY_OPTIONS}
          onValueChange={(value) => updateSetting('salary_payment_day', value)}
        />
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">급여 정산 방식</span>
          <div className="grid gap-2 md:grid-cols-2">
            {SALARY_MONTH_TYPE_OPTIONS.map((option) => {
              const checked = settings.salary_month_type === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    checked ? 'border-foreground/40 bg-muted/45' : 'border-border bg-background hover:bg-muted/30'
                  )}
                >
                  <input
                    type="radio"
                    name="salary_month_type"
                    value={option.value}
                    checked={checked}
                    onChange={(event) => updateSetting('salary_month_type', event.target.value as SalaryMonthType)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <SalaryExamplePanel settings={settings} />
    </SettingsSectionCard>
  );
}
