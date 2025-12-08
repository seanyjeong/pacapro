'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [academyName, setAcademyName] = useState('P-ACA');

  useEffect(() => {
    // 이미 설치됐거나 닫기 눌렀으면 안 보여줌
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) return;

    // 학원 이름 가져오기
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setAcademyName(user.academy?.name || user.academy_name || 'P-ACA');
      } catch {
        // 무시
      }
    }

    // beforeinstallprompt 이벤트 리스닝
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 이미 설치된 경우 체크
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // 설치 프롬프트 표시
    await deferredPrompt.prompt();

    // 사용자 선택 대기
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 24시간 동안 다시 안 물어봄
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">앱 설치</h3>
          <p className="text-gray-600 mt-2">
            <span className="font-semibold">{academyName}</span> 앱을<br />
            바탕화면에 설치하시겠습니까?
          </p>
          <p className="text-sm text-gray-400 mt-2">
            더 빠르고 편리하게 이용할 수 있습니다
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 py-6"
            onClick={handleDismiss}
          >
            <X className="h-5 w-5 mr-2" />
            나중에
          </Button>
          <Button
            className="flex-1 py-6 bg-blue-500 hover:bg-blue-600"
            onClick={handleInstall}
          >
            <Download className="h-5 w-5 mr-2" />
            설치
          </Button>
        </div>
      </div>
    </div>
  );
}
