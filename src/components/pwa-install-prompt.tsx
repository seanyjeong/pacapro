'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 이미 PWA로 실행 중이면 표시 안함
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 이미 닫기 눌렀으면 24시간 동안 표시 안함
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // iOS 체크
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // iOS Safari에서는 바로 표시
    if (isIOSDevice) {
      // Safari 브라우저인지 확인 (Chrome on iOS 등 제외)
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
      if (isSafari) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
      return;
    }

    // Android/Chrome: beforeinstallprompt 이벤트 대기
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-inset animate-in slide-in-from-bottom duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Image
              src="/icons/icon-96x96.png"
              alt="P-ACA"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">P-ACA 앱 설치</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  홈화면에 추가하면 더 빠르게 접속할 수 있어요
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              // iOS Safari 안내
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground font-medium mb-2">설치 방법:</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    1. 하단의 <Share className="h-4 w-4 inline" /> 공유 버튼
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    2. "홈 화면에 추가" <Plus className="h-4 w-4 inline" /> 선택
                  </span>
                </div>
              </div>
            ) : (
              // Android/Chrome 설치 버튼
              <button
                onClick={handleInstall}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                앱 설치하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
