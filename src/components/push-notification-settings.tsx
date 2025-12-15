'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, CheckCircle } from 'lucide-react';
import {
  pushAPI,
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  PushSubscription,
} from '@/lib/api/push';

export default function PushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      // 브라우저 지원 확인
      const isSupported = isPushSupported();
      setSupported(isSupported);

      if (!isSupported) {
        setLoading(false);
        return;
      }

      // 권한 상태 확인
      setPermission(getNotificationPermission());

      // 현재 구독 상태 확인
      const subscription = await getCurrentSubscription();
      setSubscribed(!!subscription);

      // 서버의 구독 목록 조회
      const subs = await pushAPI.getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error('푸시 상태 확인 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    setMessage(null);

    try {
      // 1. 권한 요청
      const perm = await requestNotificationPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setMessage({ type: 'error', text: '알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.' });
        return;
      }

      // 2. VAPID 공개키 가져오기
      const vapidPublicKey = await pushAPI.getVapidPublicKey();

      // 3. 푸시 구독 등록
      const subscription = await subscribeToPush(vapidPublicKey);

      if (!subscription) {
        setMessage({ type: 'error', text: '푸시 구독 등록에 실패했습니다.' });
        return;
      }

      // 4. 서버에 구독 정보 저장
      const deviceName = getDeviceName();
      await pushAPI.subscribe(subscription, deviceName);

      setSubscribed(true);
      setMessage({ type: 'success', text: '푸시 알림이 활성화되었습니다!' });

      // 구독 목록 갱신
      const subs = await pushAPI.getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error('푸시 활성화 실패:', error);
      setMessage({ type: 'error', text: '푸시 알림 활성화에 실패했습니다.' });
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    setEnabling(true);
    setMessage(null);

    try {
      const subscription = await getCurrentSubscription();

      if (subscription?.endpoint) {
        // 서버에서 구독 삭제
        await pushAPI.unsubscribe(subscription.endpoint);
      }

      // 브라우저 구독 해제
      await unsubscribeFromPush();

      setSubscribed(false);
      setMessage({ type: 'success', text: '푸시 알림이 비활성화되었습니다.' });

      // 구독 목록 갱신
      const subs = await pushAPI.getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error('푸시 비활성화 실패:', error);
      setMessage({ type: 'error', text: '푸시 알림 비활성화에 실패했습니다.' });
    } finally {
      setEnabling(false);
    }
  };

  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Mac/.test(ua)) return 'Mac';
    return '알 수 없는 기기';
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-foreground">PWA 푸시 알림</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <BellOff className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">PWA 푸시 알림</h2>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-200">
            이 브라우저는 푸시 알림을 지원하지 않습니다.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            PWA 앱으로 설치하거나 최신 브라우저를 사용해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-foreground">PWA 푸시 알림</h2>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* 현재 상태 */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {subscribed ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <BellOff className="w-6 h-6 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {subscribed ? '푸시 알림 활성화됨' : '푸시 알림 비활성화'}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscribed
                  ? '미납자 출석 시 알림을 받습니다'
                  : '알림을 받으려면 활성화하세요'}
              </p>
            </div>
          </div>

          <button
            onClick={subscribed ? handleDisable : handleEnable}
            disabled={enabling}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              subscribed
                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {enabling ? '처리 중...' : subscribed ? '비활성화' : '활성화'}
          </button>
        </div>

        {/* 등록된 기기 목록 */}
        {subscriptions.length > 0 && (
          <div className="mt-4">
            <p className="font-medium text-foreground mb-2">등록된 기기</p>
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{sub.device_name || '알 수 없는 기기'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({new Date(sub.updated_at).toLocaleDateString('ko-KR')})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 안내 사항 */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">푸시 알림 안내</p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>오늘 출석 예정인 미납 학생이 있으면 오후 6시, 9시에 알림을 보내드립니다</li>
            <li>PWA 앱으로 설치하면 더 안정적으로 알림을 받을 수 있습니다</li>
            <li>알림이 오지 않으면 브라우저/시스템 알림 설정을 확인해주세요</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
