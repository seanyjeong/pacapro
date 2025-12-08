'use client';

import { useEffect } from 'react';

export function DynamicTitle() {
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;

    try {
      const user = JSON.parse(userStr);
      const academyName = user.academy?.name || user.academy_name;

      if (academyName) {
        document.title = `P-ACA | ${academyName} 관리`;
      }
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  return null;
}
