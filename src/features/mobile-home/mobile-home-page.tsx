'use client';

import PWAInstallPrompt from '@/components/pwa-install-prompt';
import releaseInfo from '@/constants/release.json';
import { Button } from '@/components/ui/button';
import { MobileHomeFooter } from './mobile-home-footer';
import { MobileHomeHeader } from './mobile-home-header';
import { MobileHomeMenu } from './mobile-home-menu';
import { MobileHomeOperationsPanel } from './mobile-home-operations-panel';
import { MobileHomePushPanel } from './mobile-home-push-panel';
import { useMobileHomeState } from './use-mobile-home-state';

export function MobileHomePage() {
  const state = useMobileHomeState();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-home-workspace">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <MobileHomeHeader
          academyName={state.academyName}
          userName={state.userName}
        />

        <MobileHomeOperationsPanel
          dateLabel={state.todayLabels.date}
          items={state.menuItems}
          roleLabel={state.userRoleLabel}
          weekdayLabel={state.todayLabels.weekday}
        />

        <MobileHomeMenu items={state.menuItems} />

        {!state.hasPermission && (
          <Button variant="outline" onClick={state.refreshPermissions} disabled={state.permissionRefreshing}>
            {state.permissionRefreshing ? '확인 중...' : '업무 권한 다시 확인'}
          </Button>
        )}

        {state.hasPermission && <MobileHomePushPanel
          expanded={state.pushExpanded}
          loading={state.pushLoading}
          settings={state.notificationSettings}
          settingsLoading={state.settingsLoading}
          subscribed={state.pushSubscribed}
          supported={state.pushSupported}
          onSettingToggle={state.handleSettingToggle}
          onToggle={state.handlePushToggle}
          onToggleExpanded={() => state.setPushExpanded(!state.pushExpanded)}
        />}

        <MobileHomeFooter version={releaseInfo.version} onLogout={state.logout} />
      </div>

      <PWAInstallPrompt />
    </div>
  );
}
