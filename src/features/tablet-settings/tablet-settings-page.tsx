'use client';

import { TabletSettingsAccountCard } from './tablet-settings-account-card';
import { TabletSettingsError } from './tablet-settings-error';
import { TabletSettingsHeader } from './tablet-settings-header';
import { TabletSettingsLoading } from './tablet-settings-loading';
import { TabletSettingsNotice } from './tablet-settings-notice';
import { TabletSettingsOperationLinks } from './tablet-settings-operation-links';
import { TabletSettingsPushCard } from './tablet-settings-push-card';
import { TabletSettingsSystemCard } from './tablet-settings-system-card';
import { useTabletSettingsState } from './use-tablet-settings-state';

export function TabletSettingsPage() {
  const state = useTabletSettingsState();

  if (state.loading) {
    return <TabletSettingsLoading />;
  }

  if (state.loadError) {
    return <TabletSettingsError onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <TabletSettingsHeader loading={state.loading} onRefresh={state.reload} />
      <TabletSettingsNotice notice={state.notice} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          <TabletSettingsOperationLinks />
          <TabletSettingsPushCard
            notificationSavingKey={state.notificationSavingKey}
            notificationSettings={state.notificationSettings}
            pushLoading={state.pushLoading}
            pushSubscribed={state.pushSubscribed}
            pushSupported={state.pushSupported}
            onPushToggle={state.togglePush}
            onToggleNotification={state.toggleNotification}
          />
        </main>
        <aside className="order-first space-y-4 xl:order-none">
          <TabletSettingsAccountCard user={state.user} />
          <TabletSettingsSystemCard loggingOut={state.loggingOut} onLogout={state.logout} />
        </aside>
      </div>
    </div>
  );
}
