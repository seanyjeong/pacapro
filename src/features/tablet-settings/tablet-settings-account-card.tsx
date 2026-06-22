import { Building2, Mail, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTabletRoleLabel, getTabletRoleTone } from './tablet-settings-utils';
import type { TabletSettingsUser } from './tablet-settings-types';

interface TabletSettingsAccountCardProps {
  user: TabletSettingsUser | null;
}

export function TabletSettingsAccountCard({ user }: TabletSettingsAccountCardProps) {
  const displayName = user?.name || '사용자';

  return (
    <section className="rounded-md border border-border bg-background p-4" aria-label="내 계정">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserRound className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', getTabletRoleTone(user?.role))}>
              {getTabletRoleLabel(user?.role)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {user?.email || '이메일 미확인'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {user?.academy_name || 'PACA 일산'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
