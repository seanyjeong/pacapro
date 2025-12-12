'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopNav } from './topnav';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // 공개 페이지 (로그인 불필요): /c/, /m/, /login, /register, /forgot-password, /reset-password
    const isPublicPage = pathname?.startsWith('/c/') ||
                         pathname?.startsWith('/m') ||
                         pathname === '/login' ||
                         pathname === '/register' ||
                         pathname === '/forgot-password' ||
                         pathname === '/reset-password';

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
                <main className="flex-1 overflow-y-auto pt-16">
                    <div className="p-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
