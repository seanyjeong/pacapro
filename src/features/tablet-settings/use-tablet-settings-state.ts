import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { notificationSettingsAPI, type NotificationSettings } from '@/lib/api/notificationSettings';
import {
  getCurrentSubscription,
  pushAPI,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/api/push';
import {
  DEFAULT_TABLET_NOTIFICATION_SETTINGS,
  getTabletDeviceName,
  isTabletPushSupported,
  withTimeout,
} from './tablet-settings-utils';
import type { NotificationSettingKey, TabletSettingsNotice, TabletSettingsUser } from './tablet-settings-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export function useTabletSettingsState() {
  const router = useRouter();
  const [user, setUser] = useState<TabletSettingsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<TabletSettingsNotice>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_TABLET_NOTIFICATION_SETTINGS);
  const [notificationSavingKey, setNotificationSavingKey] = useState<NotificationSettingKey | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setNotice(null);

    try {
      const response = await apiClient.get<{ user: TabletSettingsUser }>('/auth/me', SILENT_CONFIG);
      setUser(response.user);

      const [notificationResult, subscription] = await Promise.all([
        notificationSettingsAPI.get(SILENT_CONFIG).catch(() => DEFAULT_TABLET_NOTIFICATION_SETTINGS),
        isTabletPushSupported() ? withTimeout(getCurrentSubscription(), null) : Promise.resolve(null),
      ]);

      setPushSupported(isTabletPushSupported());
      setPushSubscribed(!!subscription);
      setNotificationSettings(notificationResult);
    } catch {
      setUser(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const toggleNotification = async (key: NotificationSettingKey) => {
    const previous = notificationSettings;
    const next = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSavingKey(key);
    setNotificationSettings(next);
    setNotice(null);

    try {
      const saved = await notificationSettingsAPI.update(next, SILENT_CONFIG);
      setNotificationSettings(saved);
      setNotice({ tone: 'success', message: '알림 설정이 저장되었습니다.' });
    } catch {
      setNotificationSettings(previous);
      setNotice({ tone: 'error', message: '알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setNotificationSavingKey(null);
    }
  };

  const togglePush = async () => {
    if (!pushSupported) {
      setNotice({ tone: 'info', message: '이 브라우저에서는 푸시 알림을 사용할 수 없습니다.' });
      return;
    }

    setPushLoading(true);
    setNotice(null);
    try {
      if (pushSubscribed) {
        const subscription = await withTimeout(getCurrentSubscription(), null);
        if (subscription?.endpoint) {
          await pushAPI.unsubscribe(subscription.endpoint, SILENT_CONFIG);
        }
        await withTimeout(unsubscribeFromPush(), false);
        setPushSubscribed(false);
        setNotice({ tone: 'success', message: '이 태블릿의 푸시 알림을 껐습니다.' });
      } else {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
          setNotice({ tone: 'error', message: '브라우저 알림 권한을 허용해야 푸시 알림을 받을 수 있습니다.' });
          return;
        }
        const vapidPublicKey = await pushAPI.getVapidPublicKey(SILENT_CONFIG);
        const subscription = await subscribeToPush(vapidPublicKey);
        if (!subscription) throw new Error('subscription unavailable');
        await pushAPI.subscribe(subscription, getTabletDeviceName(), SILENT_CONFIG);
        setPushSubscribed(true);
        setNotice({ tone: 'success', message: '이 태블릿에서 푸시 알림을 받습니다.' });
      }
    } catch {
      setNotice({ tone: 'error', message: '푸시 알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setPushLoading(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout', undefined, SILENT_CONFIG);
    } catch {
      // 로그아웃은 로컬 세션 정리가 우선입니다.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'paca_auth=; path=/; max-age=0';
      router.push('/login');
    }
  };

  return {
    loadError,
    loading,
    loggingOut,
    logout,
    notice,
    notificationSavingKey,
    notificationSettings,
    pushLoading,
    pushSubscribed,
    pushSupported,
    reload: loadSettings,
    toggleNotification,
    togglePush,
    user,
  };
}
