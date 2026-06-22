import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <section className="rounded-md border border-border bg-background p-4" aria-label="푸시 알림">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {pushSubscribed ? <Bell className="h-5 w-5 text-emerald-600" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
            <h2 className="text-base font-semibold text-foreground">푸시 알림</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {pushSupported
              ? pushSubscribed ? `이 태블릿에서 수신 중, ${activeCount}개 알림 활성화` : `${activeCount}개 알림이 켜져 있습니다. 기기 수신은 꺼져 있습니다.`
              : '이 브라우저에서는 푸시 알림을 사용할 수 없습니다.'}
          </p>
        </div>
        <Button type="button" variant={pushSubscribed ? 'outline' : 'default'} onClick={onPushToggle} disabled={pushLoading} className="gap-2">
          {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pushSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {pushSubscribed ? '기기 알림 끄기' : '기기 알림 켜기'}
        </Button>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {notificationItems.map((item) => {
          const enabled = notificationSettings[item.key];
          const saving = notificationSavingKey === item.key;
          return (
            <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleNotification(item.key)}
                disabled={!!notificationSavingKey}
                aria-label={`${item.label} ${enabled ? '끄기' : '켜기'}`}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'} disabled:opacity-60`}
              >
                {saving ? (
                  <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                ) : (
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
