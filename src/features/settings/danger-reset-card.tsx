import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSectionCard } from './settings-section-card';
import { cn } from '@/lib/utils/cn';
import { SETTINGS_FIELD_CLASS } from './settings-constants';
import { SETTINGS_RESET_COPY } from './settings-reset-copy';

interface DangerResetCardProps {
  resetConfirmation: string;
  isResetting: boolean;
  setResetConfirmation: (value: string) => void;
  onReset: () => void;
}

export function DangerResetCard({
  resetConfirmation,
  isResetting,
  setResetConfirmation,
  onReset,
}: DangerResetCardProps) {
  return (
    <SettingsSectionCard
      id="danger-zone"
      title="위험 작업"
      description="원장 권한 전용"
      icon={AlertTriangle}
      tone="danger"
      contentClassName="space-y-4"
    >
      <div className="rounded-xl bg-destructive-soft p-4">
        <h3 className="font-bold text-destructive">{SETTINGS_RESET_COPY.title}</h3>
        <p className="mt-2 text-sm leading-6 text-destructive">
          {SETTINGS_RESET_COPY.description}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="settings-reset-confirmation" className="block text-sm font-semibold text-secondary-foreground">확인을 위해 &quot;초기화&quot;를 입력하세요</label>
        <input
          id="settings-reset-confirmation"
          type="text"
          value={resetConfirmation}
          onChange={(event) => setResetConfirmation(event.target.value)}
          placeholder={SETTINGS_RESET_COPY.confirmation}
          className={cn(SETTINGS_FIELD_CLASS, 'focus-visible:border-destructive focus-visible:ring-destructive/10')}
        />
      </div>
      <Button
        variant="destructive"
        disabled={resetConfirmation !== SETTINGS_RESET_COPY.confirmation || isResetting}
        onClick={onReset}
        className="w-full sm:w-auto"
      >
        {isResetting ? '초기화 중...' : SETTINGS_RESET_COPY.button}
      </Button>
    </SettingsSectionCard>
  );
}
