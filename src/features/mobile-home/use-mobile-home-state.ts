import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import {
  getCurrentSubscription,
  isPushSupported,
  pushAPI,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/api/push';
import { notificationSettingsAPI, type NotificationSettings } from '@/lib/api/notificationSettings';
import { canEdit, canView } from '@/lib/utils/permissions';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  makeMobileHomeMenu,
  MOBILE_HOME_MESSAGES,
} from './mobile-home-constants';
import { formatTodayLabels, getDeviceName, getMobileRoleLabel, parseMobileHomeUser, withTimeout } from './mobile-home-utils';

export function useMobileHomeState() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userName, setUserName] = useState('');
  const [userRoleLabel, setUserRoleLabel] = useState('운영 계정');
  const [academyName, setAcademyName] = useState('');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushExpanded, setPushExpanded] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [permissionRefreshing, setPermissionRefreshing] = useState(false);

  const refreshPushStatus = useCallback(async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;

    const subscription = await withTimeout(getCurrentSubscription(), 1500, null);
    setPushSubscribed(!!subscription);
    if (!subscription) return;

    try {
      const settings = await notificationSettingsAPI.get({ suppressErrorToast: true });
      setNotificationSettings(settings);
    } catch {
      setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    }
  }, []);

  const applyStoredSession = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return false;
    }

    const user = parseMobileHomeUser();
    setUserName(user.name);
    setUserRoleLabel(getMobileRoleLabel(user.role));
    setAcademyName(user.academyName);

    const canAccess = canEdit('schedules') || canView('payments') || canView('consultations');
    setHasPermission(canAccess);
    if (!canAccess) return false;

    void refreshPushStatus();
    return true;
  }, [refreshPushStatus, router]);

  const refreshCurrentSession = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await apiClient.get<{ user?: Record<string, unknown> }>('/auth/me', {
        suppressErrorToast: true,
      });
      if (!response.user) throw new Error('Current user is missing');
      localStorage.setItem('user', JSON.stringify(response.user));
      applyStoredSession();
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.cookie = 'paca_auth=; path=/; max-age=0';
      toast.error(MOBILE_HOME_MESSAGES.sessionRefreshFailed);
      router.push('/login');
    }
  }, [applyStoredSession, router]);

  useEffect(() => {
    void refreshCurrentSession();
  }, [refreshCurrentSession]);

  const refreshPermissions = async () => {
    setPermissionRefreshing(true);
    try {
      const response = await apiClient.get<{ user?: Record<string, unknown> }>('/auth/me', { suppressErrorToast: true });
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      const canAccess = applyStoredSession();
      if (!canAccess) toast.error(MOBILE_HOME_MESSAGES.noPermissionUnchanged);
    } catch {
      toast.error(MOBILE_HOME_MESSAGES.noPermissionRefreshFailed);
    } finally {
      setPermissionRefreshing(false);
    }
  };

  const schedulesPermission = hasPermission ? canEdit('schedules') : false;
  const paymentsPermission = hasPermission ? canView('payments') : false;
  const consultationsPermission = hasPermission ? canView('consultations') : false;
  const menuItems = useMemo(
    () => makeMobileHomeMenu({
      schedules: schedulesPermission,
      payments: paymentsPermission,
      consultations: consultationsPermission,
    }),
    [consultationsPermission, paymentsPermission, schedulesPermission]
  );
  const todayLabels = useMemo(() => formatTodayLabels(), []);

  const handleSettingToggle = async (key: keyof NotificationSettings) => {
    setSettingsLoading(true);
    try {
      const nextSettings = { ...notificationSettings, [key]: !notificationSettings[key] };
      const saved = await notificationSettingsAPI.update(nextSettings, { suppressErrorToast: true });
      setNotificationSettings(saved);
    } catch {
      toast.error(MOBILE_HOME_MESSAGES.settingFailed);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        const subscription = await withTimeout(getCurrentSubscription(), 1500, null);
        if (subscription?.endpoint) await pushAPI.unsubscribe(subscription.endpoint, { suppressErrorToast: true });
        await unsubscribeFromPush();
        setPushSubscribed(false);
        setPushExpanded(false);
        return;
      }

      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        toast.error(MOBILE_HOME_MESSAGES.pushDenied);
        return;
      }
      const vapidPublicKey = await pushAPI.getVapidPublicKey({ suppressErrorToast: true });
      const subscription = await subscribeToPush(vapidPublicKey);
      if (!subscription) {
        toast.error(MOBILE_HOME_MESSAGES.pushEnableFailed);
        return;
      }
      await pushAPI.subscribe(subscription, getDeviceName(), { suppressErrorToast: true });
      setPushSubscribed(true);
      setPushExpanded(true);
    } catch {
      toast.error(pushSubscribed ? MOBILE_HOME_MESSAGES.pushDisableFailed : MOBILE_HOME_MESSAGES.pushEnableFailed);
    } finally {
      setPushLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'paca_auth=; path=/; max-age=0';
    router.push('/login');
  };

  return {
    academyName,
    handlePushToggle,
    handleSettingToggle,
    hasPermission,
    logout,
    menuItems,
    notificationSettings,
    permissionRefreshing,
    pushExpanded,
    pushLoading,
    pushSubscribed,
    pushSupported,
    router,
    refreshPermissions,
    setPushExpanded,
    settingsLoading,
    todayLabels,
    userName,
    userRoleLabel,
  };
}
