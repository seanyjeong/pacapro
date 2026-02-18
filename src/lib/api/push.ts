/**
 * PWA Push notifications API client
 * Backend: /push/* endpoints
 */

import apiClient from './client';

export interface PushSubscription {
  id: number;
  academy_id?: number;
  user_id?: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const pushAPI = {
  // VAPID public key - not in backend yet, placeholder
  getVapidPublicKey: async (): Promise<string> => {
    const response = await apiClient.get<{ publicKey: string }>('/push/vapid-public-key');
    return response.publicKey;
  },

  // POST /push/subscribe → flat dict
  // Backend body: {endpoint, p256dh, auth}
  subscribe: async (subscription: PushSubscriptionJSON, deviceName?: string): Promise<PushSubscription> => {
    return apiClient.post<PushSubscription>('/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      device_name: deviceName,
    });
  },

  // DELETE /push/unsubscribe?endpoint=...
  unsubscribe: async (endpoint: string): Promise<void> => {
    await apiClient.delete('/push/unsubscribe', {
      params: { endpoint },
    });
  },

  // GET /push/subscriptions → flat array
  getSubscriptions: async (): Promise<PushSubscription[]> => {
    return apiClient.get<PushSubscription[]>('/push/subscriptions');
  },

  // Test push - not in backend yet, placeholder
  sendTest: async (): Promise<{ success: number; failed: number }> => {
    return apiClient.post<{ success: number; failed: number }>('/push/test');
  },
};

// Browser push notification utilities

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    return subscription.toJSON();
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    return true;
  } catch (error) {
    console.error('Push unsubscribe failed:', error);
    return false;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscriptionJSON | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.toJSON() || null;
  } catch {
    return null;
  }
}

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
