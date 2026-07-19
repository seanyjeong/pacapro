import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSectionCard } from './settings-section-card';
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
      title="위험 작업"
      description="원장 권한 전용"
      icon={AlertTriangle}
      className="border-red-200 bg-red-50/40"
      contentClassName="space-y-4"
    >
      <div className="rounded-lg border border-red-200 bg-background p-4">
        <h4 className="font-semibold text-red-700">{SETTINGS_RESET_COPY.title}</h4>
        <p className="mt-2 text-sm leading-6 text-red-700">
          {SETTINGS_RESET_COPY.description}
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">확인을 위해 &quot;초기화&quot;를 입력하세요</label>
        <input
          type="text"
          value={resetConfirmation}
          onChange={(event) => setResetConfirmation(event.target.value)}
          placeholder={SETTINGS_RESET_COPY.confirmation}
          className="h-10 w-full rounded-md border border-red-200 bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-red-200"
        />
      </div>
      <Button
        variant="destructive"
        disabled={resetConfirmation !== SETTINGS_RESET_COPY.confirmation || isResetting}
        onClick={onReset}
        className="w-full"
      >
        {isResetting ? '초기화 중...' : SETTINGS_RESET_COPY.button}
      </Button>
    </SettingsSectionCard>
  );
}
