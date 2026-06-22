import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSectionCard } from './settings-section-card';

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
        <h4 className="font-semibold text-red-700">전체 데이터 초기화</h4>
        <p className="mt-2 text-sm leading-6 text-red-700">
          학생, 강사, 수납, 급여, 스케줄, 시즌 정보가 삭제됩니다. 되돌릴 수 없습니다.
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">확인을 위해 &quot;초기화&quot;를 입력하세요</label>
        <input
          type="text"
          value={resetConfirmation}
          onChange={(event) => setResetConfirmation(event.target.value)}
          placeholder="초기화"
          className="h-10 w-full rounded-md border border-red-200 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>
      <Button
        variant="destructive"
        disabled={resetConfirmation !== '초기화' || isResetting}
        onClick={onReset}
        className="w-full"
      >
        {isResetting ? '초기화 중...' : '전체 데이터 초기화'}
      </Button>
    </SettingsSectionCard>
  );
}
