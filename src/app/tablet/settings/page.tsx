'use client';

/**
 * 태블릿 설정 페이지
 * - 사용자 정보, 알림 설정, 앱 설정
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User, LogOut, RefreshCw, Settings, Info, Loader2,
  Bell, BellOff, ChevronDown, CreditCard, CalendarClock, MessageSquarePlus, UserPlus
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import {
  pushAPI,
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '@/lib/api/push';
import { notificationSettingsAPI, NotificationSettings } from '@/lib/api/notificationSettings';

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  academy_name: string;
}

export default function TabletSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // 푸시 알림 상태
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushExpanded, setPushExpanded] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    unpaid_attendance: true,
    consultation_reminder: true,
    new_consultation: true,
    pause_ending: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    fetchUserInfo();
    checkPushStatus();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await apiClient.get<{ user: UserInfo }>('/auth/me');
      setUser(res.user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPushStatus = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      const subscription = await getCurrentSubscription();
      setPushSubscribed(!!subscription);

      // 알림 설정 조회
      try {
        const settings = await notificationSettingsAPI.get();
        setNotificationSettings(settings);
      } catch {
        // 설정 조회 실패 시 기본값 유지
      }
    }
  };

  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android Tablet';
    return '태블릿';
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        // 비활성화
        const subscription = await getCurrentSubscription();
        if (subscription?.endpoint) {
          await pushAPI.unsubscribe(subscription.endpoint);
        }
        await unsubscribeFromPush();
        setPushSubscribed(false);
      } else {
        // 활성화
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          alert('알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
          return;
        }
        const vapidPublicKey = await pushAPI.getVapidPublicKey();
        const subscription = await subscribeToPush(vapidPublicKey);
        if (subscription) {
          await pushAPI.subscribe(subscription, getDeviceName());
          setPushSubscribed(true);
        }
      }
    } catch (error) {
      console.error('푸시 설정 오류:', error);
      alert('푸시 알림 설정에 실패했습니다.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSettingToggle = async (key: keyof NotificationSettings) => {
    setSettingsLoading(true);
    try {
      const newSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key],
      };
      await notificationSettingsAPI.update(newSettings);
      setNotificationSettings(newSettings);
    } catch (error) {
      console.error('알림 설정 저장 실패:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token');
      router.push('/login');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: '원장',
      admin: '관리자',
      staff: '직원',
      instructor: '강사'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100/80 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      admin: 'bg-blue-100/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      staff: 'bg-green-100/80 dark:bg-green-900 text-green-800 dark:text-green-200',
      instructor: 'bg-orange-100/80 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
    };
    return colors[role] || 'bg-gray-100/80 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">설정</h1>
          <p className="text-muted-foreground">계정 및 앱 설정</p>
        </div>
      </div>

      {/* 사용자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            내 계정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">{user?.name || '사용자'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getRoleColor(user?.role || '')}>
                  {getRoleLabel(user?.role || '')}
                </Badge>
                <span className="text-sm text-muted-foreground">{user?.academy_name}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 푸시 알림 설정 */}
      {pushSupported && (
        <Card>
          <CardHeader className="pb-0">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => pushSubscribed && setPushExpanded(!pushExpanded)}
            >
              <CardTitle className="flex items-center gap-2">
                {pushSubscribed ? (
                  <Bell className="w-5 h-5 text-green-600" />
                ) : (
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                )}
                푸시 알림
              </CardTitle>
              <div className="flex items-center gap-2">
                {pushSubscribed && (
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${pushExpanded ? 'rotate-180' : ''}`} />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePushToggle();
                  }}
                  disabled={pushLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pushSubscribed
                      ? 'bg-red-100/80 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-primary text-white'
                  } disabled:opacity-50`}
                >
                  {pushLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : pushSubscribed ? '끄기' : '켜기'}
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {pushSubscribed
                ? `${Object.values(notificationSettings).filter(Boolean).length}개 알림 활성화됨`
                : '알림을 받으려면 활성화하세요'}
            </p>
          </CardHeader>

          {/* 알림 종류 설정 */}
          {pushSubscribed && pushExpanded && (
            <CardContent className="pt-4 space-y-3">
              {[
                { key: 'unpaid_attendance' as const, icon: CreditCard, title: '미납자 출석 알림', desc: '18:00, 21:00' },
                { key: 'consultation_reminder' as const, icon: CalendarClock, title: '상담 30분 전 알림', desc: '상담 리마인더' },
                { key: 'new_consultation' as const, icon: MessageSquarePlus, title: '새 상담 예약', desc: '즉시 알림' },
                { key: 'pause_ending' as const, icon: UserPlus, title: '휴원 종료 알림', desc: '09:00' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSettingToggle(item.key)}
                    disabled={settingsLoading}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      notificationSettings[item.key]
                        ? 'bg-primary'
                        : 'bg-gray-300 dark:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        notificationSettings[item.key] ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* 앱 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            앱 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-3" />
            앱 새로고침
          </Button>
        </CardContent>
      </Card>

      {/* 버전 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            앱 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">버전</span>
            <span className="text-foreground font-medium">P-ACA Tablet v3.1.16</span>
          </div>
        </CardContent>
      </Card>

      {/* 로그아웃 */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4 mr-2" />
        )}
        {loggingOut ? '로그아웃 중...' : '로그아웃'}
      </Button>
    </div>
  );
}
