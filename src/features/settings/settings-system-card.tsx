import { Shield } from 'lucide-react';
import releaseInfo from '../../constants/release.json';
import { SettingsReadonlyField } from './settings-readonly-field';
import { SettingsSectionCard } from './settings-section-card';

export function SettingsSystemCard() {
  return (
    <SettingsSectionCard title="시스템 정보" icon={Shield} contentClassName="space-y-4">
      <SettingsReadonlyField label="버전" value={`v${releaseInfo.version}`} />
      <SettingsReadonlyField label="마지막 업데이트" value={releaseInfo.lastUpdate} />
      <SettingsReadonlyField label="데이터 상태" value="정상" />
      <SettingsReadonlyField label="문의사항" value="010-2144-6755" />
    </SettingsSectionCard>
  );
}
