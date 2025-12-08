'use client';

import { useEffect } from 'react';

// package.json의 버전과 동일하게 유지
const APP_VERSION = '2.6.12';

export function VersionChecker() {
    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');

        if (storedVersion !== APP_VERSION) {
            console.log(`[VersionChecker] 버전 업데이트 감지: ${storedVersion} → ${APP_VERSION}`);

            // 토큰은 유지하고 나머지 캐시 클리어
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            // localStorage 전체 클리어
            localStorage.clear();

            // 토큰과 사용자 정보 복원 (로그인 유지)
            if (token) localStorage.setItem('token', token);
            if (user) localStorage.setItem('user', user);

            // 새 버전 저장
            localStorage.setItem('app_version', APP_VERSION);

            // 페이지 새로고침으로 새 버전 적용
            window.location.reload();
        }
    }, []);

    return null;
}
