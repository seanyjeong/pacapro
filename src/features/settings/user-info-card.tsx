import { User } from 'lucide-react';
import { SettingsReadonlyField } from './settings-readonly-field';
import { SettingsSectionCard } from './settings-section-card';
import type { SettingsUser } from './settings-types';
import { getRoleLabel } from './settings-utils';

interface UserInfoCardProps {
  user: SettingsUser | null;
  loading: boolean;
}

export function UserInfoCard({ user, loading }: UserInfoCardProps) {
  return (
    <SettingsSectionCard title="내 정보" icon={User} contentClassName="space-y-4">
      <SettingsReadonlyField label="이름" value={user?.name} loading={loading} />
      <SettingsReadonlyField label="이메일" value={user?.email} loading={loading} />
      <SettingsReadonlyField label="권한" value={getRoleLabel(user?.role)} loading={loading} />
    </SettingsSectionCard>
  );
}
