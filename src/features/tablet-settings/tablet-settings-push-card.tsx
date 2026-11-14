import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';
import type { NotificationSettings } from '@/lib/api/notificationSettings';
import { getActiveNotificationCount } from './tablet-settings-utils';
import type { NotificationSettingKey } from './tablet-settings-types';

const notificationItems: { key: NotificationSettingKey; label: string; description: string }[] = [
  { key: 'unpaid_attendance', label: '미납자 출석 알림', description: '18시, 21시 미납 출석 체크' },
  { key: 'consultation_reminder', label: '상담 30분 전 알림', description: '예약 상담 전 리마인더' },
  { key: 'new_consultation', label: '새 상담 예약 알림', description: '신규상담이 들어오면 즉시 확인' },
  { key: 'pause_ending', label: '휴원 종료 알림', description: '복귀 예정 학생 체크' },
];

interface TabletSettingsPushCardProps {
  notificationSavingKey: NotificationSettingKey | null;
  notificationSettings: NotificationSettings;
  pushLoading: boolean;
  pushSubscribed: boolean;
  pushSupported: boolean;
  onPushToggle: () => void;
  onToggleNotification: (key: NotificationSettingKey) => void;
}

export function TabletSettingsPushCard({
  notificationSavingKey,
  notificationSettings,
  pushLoading,
  pushSubscribed,
  pushSupported,
  onPushToggle,
  onToggleNotification,
}: TabletSettingsPushCardProps) {
  const activeCount = getActiveNotificationCount(notificationSettings);

  return (
    <section className="rounded-2xl bg-card p-5" aria-label="푸시 알림">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', pushSubscribed ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>
            {pushSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-foreground">푸시 알림</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {pushSupported
                ? pushSubscribed ? `이 태블릿에서 받는 중, ${activeCount}개 알림 켜짐` : `${activeCount}개 알림이 켜져 있어요. 기기 수신은 꺼져 있어요.`
                : '이 브라우저에서는 푸시 알림을 쓸 수 없어요.'}
            </p>
          </div>
        </div>
        <Button type="button" variant={pushSubscribed ? 'outline' : 'default'} onClick={onPushToggle} disabled={pushLoading} className="shrink-0">
          {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pushSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {pushSubscribed ? '기기 알림 끄기' : '기기 알림 켜기'}
        </Button>
      </div>

      <ul className="mt-4 grid gap-x-6 border-t border-border/60 pt-2 md:grid-cols-2">
        {notificationItems.map((item) => {
          const enabled = notificationSettings[item.key];
          const saving = notificationSavingKey === item.key;
          return (
            <li key={item.key} className="flex min-h-[64px] items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</p>
              </div>
              {saving ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-label={`${item.label} 저장 중`} />
              ) : (
                <Switch
                  checked={enabled}
                  onCheckedChange={() => onToggleNotification(item.key)}
                  disabled={!!notificationSavingKey}
                  aria-label={`${item.label} ${enabled ? '끄기' : '켜기'}`}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
