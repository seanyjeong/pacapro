import { Bell, BellOff, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
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
    <section className="rounded-2xl bg-card p-2" aria-label="푸시 알림">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
          onClick={subscribed ? onToggleExpanded : undefined}
          aria-expanded={subscribed ? expanded : undefined}
        >
          <span className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            subscribed ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
          )}>
            {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[16px] font-bold text-foreground">
              푸시 알림
              {subscribed && <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
              {subscribed ? `${activeCount}개 알림이 켜져 있어요` : '현장 알림을 받을 기기에서 켜 주세요'}
            </span>
          </span>
        </button>

        <Button
          type="button"
          size="sm"
          variant={subscribed ? 'outline' : 'default'}
          onClick={onToggle}
          disabled={loading}
          className="h-10 min-w-[64px] shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? '끄기' : '켜기'}
        </Button>
      </div>

      {subscribed && expanded && (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60 px-3">
          {MOBILE_PUSH_SETTING_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="flex min-h-[60px] items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">{item.title}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSettingToggle(item.key)}
                  disabled={settingsLoading}
                  aria-label={`${item.title} ${settings[item.key] ? '끄기' : '켜기'}`}
                  className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', settings[item.key] ? 'bg-primary' : 'bg-border')}
                >
                  <span className={cn('absolute left-0 top-0.5 h-6 w-6 rounded-full bg-card transition-transform', settings[item.key] ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
