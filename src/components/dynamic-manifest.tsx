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

      // 기존 manifest 링크 찾기
      const existingLink = document.querySelector('link[rel="manifest"]');

      if (existingLink) {
        // 동적 manifest URL로 변경
        existingLink.setAttribute('href', `/api/manifest?name=${encodeURIComponent(academyName)}`);
      }
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  return null;
}
