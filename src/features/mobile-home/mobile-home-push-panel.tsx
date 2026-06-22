import { Bell, BellOff, ChevronDown, Loader2 } from 'lucide-react';
import { MOBILE_PUSH_SETTING_ITEMS } from './mobile-home-constants';
import type { NotificationSettings } from '@/lib/api/notificationSettings';

interface MobileHomePushPanelProps {
  expanded: boolean;
  loading: boolean;
  settings: NotificationSettings;
  settingsLoading: boolean;
  subscribed: boolean;
  supported: boolean;
  onSettingToggle: (key: keyof NotificationSettings) => void;
  onToggle: () => void;
  onToggleExpanded: () => void;
}

export function MobileHomePushPanel({
  expanded,
  loading,
  settings,
  settingsLoading,
  subscribed,
  supported,
  onSettingToggle,
  onToggle,
  onToggleExpanded,
}: MobileHomePushPanelProps) {
  if (!supported) return null;

  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" aria-label="푸시 알림">
      <div className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={subscribed ? onToggleExpanded : undefined}
        >
          {subscribed ? (
            <Bell className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
          ) : (
            <BellOff className="h-5 w-5 shrink-0 text-zinc-400" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">푸시 알림</span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {subscribed ? `${activeCount}개 알림 활성화됨` : '현장 알림을 받을 기기에서 켜주세요'}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {subscribed && (
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${expanded ? 'rotate-180' : ''}`} />
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={loading}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50
              ${subscribed
                ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
                : 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950'}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? '끄기' : '켜기'}
          </button>
        </div>
      </div>

      {subscribed && expanded && (
        <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          {MOBILE_PUSH_SETTING_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{item.title}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSettingToggle(item.key)}
                  disabled={settingsLoading}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                    settings[item.key] ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  aria-label={`${item.title} ${settings[item.key] ? '끄기' : '켜기'}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition dark:bg-zinc-950 ${
                      settings[item.key] ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
