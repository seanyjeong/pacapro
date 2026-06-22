import { Calendar } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { SEASON_FEE_FIELDS } from './settings-constants';
import { SettingsSectionCard } from './settings-section-card';
import type { AcademySettings, SeasonFeeKey } from './settings-types';

interface SeasonFeesCardProps {
  settings: AcademySettings;
  updateSeasonFee: (key: SeasonFeeKey, value: number) => void;
}

export function SeasonFeesCard({ settings, updateSeasonFee }: SeasonFeesCardProps) {
  return (
    <SettingsSectionCard title="시즌비" description="입시 유형별 시즌 비용" icon={Calendar}>
      <div className="grid gap-3 md:grid-cols-3">
        {SEASON_FEE_FIELDS.map((field) => (
          <div key={field.key} className="rounded-lg border border-border bg-muted/25 p-4">
            <label className="mb-2 block text-sm font-medium text-foreground">{field.label}</label>
            <MoneyInput value={settings.season_fees[field.key]} onChange={(value) => updateSeasonFee(field.key, value)} />
          </div>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
