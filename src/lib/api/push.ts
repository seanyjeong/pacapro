/**
 * PWA 푸시 알림 API 클라이언트
 */

import apiClient from './client';

export interface PushSubscription {
  id: number;
  device_name: string | null;
  created_at: string;
  updated_at: string;
}

interface VapidPublicKeyResponse {
  publicKey: string;
}

interface SubscriptionsResponse {
  message: string;
  subscriptions: PushSubscription[];
}

interface TestPushResponse {
  message: string;
  success: number;
  failed: number;
}

export const pushAPI = {
  // VAPID 공개키 조회
  getVapidPublicKey: async (): Promise<string> => {
    const response = await apiClient.get<VapidPublicKeyResponse>('/push/vapid-public-key');
    return response.publicKey;
  },

  // 푸시 구독 등록
  subscribe: async (subscription: PushSubscriptionJSON, deviceName?: string): Promise<void> => {
    await apiClient.post('/push/subscribe', { subscription, deviceName });
  },

  // 푸시 구독 해제
  unsubscribe: async (endpoint: string): Promise<void> => {
    await apiClient.delete('/push/subscribe', { data: { endpoint } });
  },

  // 내 구독 목록 조회
  getSubscriptions: async (): Promise<PushSubscription[]> => {
    const response = await apiClient.get<SubscriptionsResponse>('/push/subscriptions');
    return response.subscriptions;
  },

  // 테스트 푸시 발송
  sendTest: async (): Promise<{ success: number; failed: number }> => {
    const response = await apiClient.post<TestPushResponse>('/push/test');
    return { success: response.success, failed: response.failed };
  },
};

// 브라우저 푸시 알림 지원 여부 확인
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// 현재 알림 권한 상태
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

// 알림 권한 요청
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

// 푸시 구독 등록
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  try {
    const registration = await navigator.serviceWorker.ready;

    // 기존 구독이 있는지 확인
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 새 구독 생성
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    return subscription.toJSON();
  } catch (error) {
    console.error('푸시 구독 실패:', error);
    return null;
  }
}

// 푸시 구독 해제
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error('푸시 구독 해제 실패:', error);
    return false;
  }
}

// 현재 구독 상태 확인
export async function getCurrentSubscription(): Promise<PushSubscriptionJSON | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.toJSON() || null;
  } catch {
    return null;
  }
}

// 로컬 테스트 알림 (서버/WNS 거치지 않고 직접 표시)
export async function sendLocalTestNotification(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('P-ACA 로컬 테스트', {
      body: '이 알림이 보이면 알림 시스템이 정상입니다!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'paca-local-test',
    } as NotificationOptions);
    return true;
  } catch (error) {
    console.error('로컬 테스트 알림 실패:', error);
    return false;
  }
}

// VAPID 공개키 변환 유틸리티
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
