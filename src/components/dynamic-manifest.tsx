'use client';

import { useEffect } from 'react';

export function DynamicManifest() {
  useEffect(() => {
    // localStorage에서 user 정보 가져오기
    const userStr = localStorage.getItem('user');
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      const academyName = user.academy?.name || user.academy_name || 'P-ACA';

      // 기존 manifest 링크 제거
      const existingLink = document.querySelector('link[rel="manifest"]');
      if (existingLink) {
        existingLink.remove();
      }

      // 새 manifest 링크 추가 (브라우저가 다시 읽도록)
      const newLink = document.createElement('link');
      newLink.rel = 'manifest';
      newLink.href = `/api/manifest?name=${encodeURIComponent(academyName)}`;
      document.head.appendChild(newLink);

      // 설치 준비 완료 표시
      window.dispatchEvent(new CustomEvent('manifestReady', { detail: { academyName } }));
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  return null;
}
