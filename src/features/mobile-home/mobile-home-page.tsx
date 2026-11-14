'use client';

import PWAInstallPrompt from '@/components/pwa-install-prompt';
import releaseInfo from '@/constants/release.json';
import { Button } from '@/components/ui/button';
import { MobileHomeFooter } from './mobile-home-footer';
import { MobileHomeHeader } from './mobile-home-header';
import { MobileHomeMenu } from './mobile-home-menu';
import { MobileHomeOperationsPanel } from './mobile-home-operations-panel';
import { MobileHomePushPanel } from './mobile-home-push-panel';
import { MobileLoading } from './mobile-screen';
import { useMobileHomeState } from './use-mobile-home-state';

export function MobileHomePage() {
  const state = useMobileHomeState();

  if (state.hasPermission === null) {
    return <MobileLoading />;
  }

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background px-4 pb-6 pt-3 text-foreground sm:-my-8" data-testid="mobile-home-workspace">
      <div className="space-y-4">
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
          <Button variant="outline" className="h-12 w-full" onClick={state.refreshPermissions} disabled={state.permissionRefreshing}>
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
