'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopNav } from './topnav';
import { cn } from '@/lib/utils/cn';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedCollapsed = localStorage.getItem('sidebar_collapsed');
        if (savedCollapsed !== null) {
            setSidebarCollapsed(savedCollapsed === 'true');
        }

        // localStorage 변경 감지
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'sidebar_collapsed') {
                setSidebarCollapsed(e.newValue === 'true');
            }
        };

        // 커스텀 이벤트로 같은 탭에서의 변경도 감지
        const handleSidebarToggle = () => {
            const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
            setSidebarCollapsed(collapsed);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('sidebar-toggle', handleSidebarToggle);

        // 주기적으로 체크 (같은 탭 내 변경 감지용)
        const interval = setInterval(() => {
            const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
            setSidebarCollapsed(collapsed);
        }, 100);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('sidebar-toggle', handleSidebarToggle);
            clearInterval(interval);
        };
    }, []);

    // 인증 페이지 (로그인, 회원가입, 비밀번호 찾기): 사이드바 없이 children만 반환
    const isAuthPage = pathname === '/login' ||
                       pathname === '/register' ||
                       pathname === '/forgot-password' ||
                       pathname === '/reset-password';

    if (isAuthPage) {
        return <>{children}</>;
    }

    // 태블릿 페이지: 자체 레이아웃 사용
    const isTabletPage = pathname?.startsWith('/tablet');
    if (isTabletPage) {
        return <>{children}</>;
    }

    // 공개 페이지 (상담 신청, 예약 변경, 모바일): 간소화된 레이아웃
    const isPublicPage = pathname?.startsWith('/c/') || pathname?.startsWith('/m') || pathname?.startsWith('/consultation/');

    if (isPublicPage) {
        return (
            <div className="min-h-screen bg-gray-50">
                <main className="w-full max-w-lg mx-auto px-4 py-6 sm:py-8">
                    {children}
                </main>
                <footer className="py-4 text-center text-xs text-gray-400">
                    Powered by P-ACA
                </footer>
            </div>
        );
    }

    // 일반 페이지는 사이드바/TopNav 포함
    return (
        <div className="flex h-screen overflow-hidden overflow-x-hidden">
            <Sidebar />
            <div className={cn(
                "flex-1 flex flex-col transition-all duration-300 ease-in-out",
                mounted ? (sidebarCollapsed ? "md:ml-[68px]" : "md:ml-64") : "md:ml-[68px]"
            )}>
                <TopNav />
                {/* 메인 콘텐츠 영역에 배경색 추가 (깊이감 부여) */}
                <main className="flex-1 overflow-y-auto pt-16 bg-slate-50/50 dark:bg-background">
                    <div className="p-4 md:p-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
