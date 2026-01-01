'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit, canView } from '@/lib/utils/permissions';
import { UserCheck, Users, CreditCard, LogOut, ChevronRight, ChevronDown, Bell, BellOff, Loader2, CalendarClock, MessageSquarePlus, UserPlus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import {
  pushAPI,
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '@/lib/api/push';
import { notificationSettingsAPI, NotificationSettings } from '@/lib/api/notificationSettings';
import PWAInstallPrompt from '@/components/pwa-install-prompt';

export default function MobileHomePage() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [academyName, setAcademyName] = useState<string>('');

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
    // 로그인 체크
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // 사용자 정보 로드
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserName(user.name || user.username || '');
        setAcademyName(user.academy?.name || user.academy_name || '');
      } catch {
        // ignore
      }
    }

    // 권한 체크: schedules.edit 또는 payments.view 중 하나라도 있으면 접근 가능
    const canAccess = canEdit('schedules') || canView('payments');
    setHasPermission(canAccess);

    if (!canAccess) {
      router.push('/login');
    }

    // 푸시 알림 상태 체크
    checkPushStatus();
  }, [router]);

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

  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    return '모바일';
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  const menuItems = [
    {
      href: '/m/attendance',
      icon: UserCheck,
      label: '학생 출석체크',
      description: '날짜/시간대별 출석 관리',
      iconBg: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/instructor',
      icon: Users,
      label: '강사 출근체크',
      description: '강사 출퇴근 기록',
      iconBg: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/unpaid',
      icon: CreditCard,
      label: '미납자 확인',
      description: '미납 학생 목록 조회',
      iconBg: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      permission: canView('payments'),
    },
    {
      href: '/m/consultations',
      icon: MessageSquare,
      label: '오늘 상담',
      description: '오늘 예정된 상담 목록',
      iconBg: 'bg-green-50 dark:bg-green-950/50',
      iconColor: 'text-green-600 dark:text-green-400',
      permission: canView('consultations'),
    },
  ];

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const weekdayStr = today.toLocaleDateString('ko-KR', { weekday: 'long' });

  return (
    <div className="min-h-screen bg-background p-5 safe-area-inset">
      {/* 헤더 */}
      <header className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Image
              src="/icons/icon-96x96.png"
              alt="P-ACA"
              width={56}
              height={56}
              className="rounded-xl"
            />
          </div>
        </div>
        {academyName && (
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{academyName}</h1>
        )}
        {userName && (
          <p className="text-muted-foreground mt-1">{userName}님 안녕하세요</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {dateStr} <span className="text-primary font-medium">{weekdayStr}</span>
        </p>
      </header>

      {/* 메뉴 버튼 */}
      <div className="space-y-3">
        {menuItems.map((item) => {
          if (!item.permission) return null;

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="w-full bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4
                         shadow-sm hover:shadow-md hover:border-border
                         active:scale-[0.98] transition-all duration-200 group"
            >
              <div className={`p-3.5 rounded-xl ${item.iconBg}`}>
                <item.icon className={`h-6 w-6 ${item.iconColor}`} />
              </div>
              <div className="text-left flex-1">
                <span className="text-lg font-semibold text-foreground block">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>

      {/* 푸시 알림 설정 */}
      {pushSupported && (
        <div className="mt-8 bg-card border border-border/60 rounded-2xl overflow-hidden">
          {/* 헤더 */}
          <div
            className="p-5 flex items-center justify-between cursor-pointer"
            onClick={() => pushSubscribed && setPushExpanded(!pushExpanded)}
          >
            <div className="flex items-center gap-3">
              {pushSubscribed ? (
                <Bell className="h-5 w-5 text-green-600" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-foreground">푸시 알림</p>
                <p className="text-xs text-muted-foreground">
                  {pushSubscribed
                    ? `${Object.values(notificationSettings).filter(Boolean).length}개 알림 활성화됨`
                    : '알림을 받으려면 활성화하세요'}
                </p>
              </div>
            </div>
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
                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                    : 'bg-blue-600 text-white'
                } disabled:opacity-50`}
              >
                {pushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : pushSubscribed ? '끄기' : '켜기'}
              </button>
            </div>
          </div>

          {/* 알림 종류 설정 (펼치기) */}
          {pushSubscribed && pushExpanded && (
            <div className="border-t border-border/60 p-4 space-y-3 bg-muted/30">
              {[
                { key: 'unpaid_attendance' as const, icon: CreditCard, title: '미납자 출석 알림', desc: '18:00, 21:00' },
                { key: 'consultation_reminder' as const, icon: CalendarClock, title: '상담 30분 전 알림', desc: '상담 리마인더' },
                { key: 'new_consultation' as const, icon: MessageSquarePlus, title: '새 상담 예약', desc: '즉시 알림' },
                { key: 'pause_ending' as const, icon: UserPlus, title: '휴원 종료 알림', desc: '09:00' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSettingToggle(item.key)}
                    disabled={settingsLoading}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notificationSettings[item.key]
                        ? 'bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        notificationSettings[item.key] ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 로그아웃 버튼 */}
      <div className="mt-6">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full py-6 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5 mr-2" />
          로그아웃
        </Button>
      </div>

      {/* 버전 정보 */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground/60">P-ACA Mobile v3.1.14</p>
      </div>

      {/* PWA 설치 프롬프트 */}
      <PWAInstallPrompt />
    </div>
  );
}
