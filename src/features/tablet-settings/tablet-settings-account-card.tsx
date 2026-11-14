import { Building2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTabletRoleLabel, getTabletRoleTone } from './tablet-settings-utils';
import type { TabletSettingsUser } from './tablet-settings-types';

interface TabletSettingsAccountCardProps {
  user: TabletSettingsUser | null;
}

export function TabletSettingsAccountCard({ user }: TabletSettingsAccountCardProps) {
  const displayName = user?.name || '사용자';

  return (
    <section className="rounded-2xl bg-card p-5" aria-label="내 계정">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
          {displayName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
            <Badge variant={getTabletRoleTone(user?.role)}>{getTabletRoleLabel(user?.role)}</Badge>
          </div>
          <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{user?.email || '이메일 미확인'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0" />
              {user?.academy_name || 'PACA 일산'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
