'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopNav } from './topnav';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

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
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
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
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-64">
                <TopNav />
                {/* 메인 콘텐츠 영역에 배경색 추가 (깊이감 부여) */}
                <main className="flex-1 overflow-y-auto pt-16 bg-slate-50/50 dark:bg-background">
                    <div className="p-4 md:p-6 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
