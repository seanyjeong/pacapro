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
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="푸시 알림">
      <div className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={subscribed ? onToggleExpanded : undefined}
        >
          {subscribed ? (
            <Bell className="h-5 w-5 shrink-0 text-success" />
          ) : (
            <BellOff className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">푸시 알림</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {subscribed ? `${activeCount}개 알림 활성화됨` : '현장 알림을 받을 기기에서 켜주세요'}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {subscribed && (
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? 'rotate-180' : ''}`} />
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={loading}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50
              ${subscribed
                ? 'bg-muted text-secondary-foreground'
                : 'bg-foreground text-white'}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? '끄기' : '켜기'}
          </button>
        </div>
      </div>

      {subscribed && expanded && (
        <div className="space-y-3 border-t border-border bg-muted p-4">
          {MOBILE_PUSH_SETTING_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSettingToggle(item.key)}
                  disabled={settingsLoading}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                    settings[item.key] ? 'bg-foreground' : 'bg-muted-foreground/40'
                  }`}
                  aria-label={`${item.title} ${settings[item.key] ? '끄기' : '켜기'}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-card transition ${
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
