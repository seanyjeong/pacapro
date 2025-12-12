'use client';

import { useEffect } from 'react';

// package.json의 버전과 동일하게 유지
const APP_VERSION = '2.9.15';

export function VersionChecker() {
    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');
        const reloadAttempt = sessionStorage.getItem('version_reload_attempt');

        // 이미 새로고침 시도한 경우 무한 루프 방지
        if (reloadAttempt === APP_VERSION) {
            console.log(`[VersionChecker] 이미 새로고침 시도됨, 스킵`);
            localStorage.setItem('app_version', APP_VERSION);
            return;
        }

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

            // 새로고침 시도 기록 (세션 스토리지는 새로고침 후에도 유지됨)
            sessionStorage.setItem('version_reload_attempt', APP_VERSION);

            // 서비스 워커 캐시 클리어
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => {
                        caches.delete(name);
                        console.log(`[VersionChecker] 캐시 삭제: ${name}`);
                    });
                }).then(() => {
                    // 서비스 워커 업데이트 강제
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then((registrations) => {
                            registrations.forEach((registration) => {
                                registration.update();
                            });
                        });
                    }
                    // 페이지 새로고침 (캐시 무시)
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        }
    }, []);

    return null;
}
