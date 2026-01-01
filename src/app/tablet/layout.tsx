'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';
import { OrientationContext } from '@/components/tablet/orientation-context';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Calendar,
  LogOut,
  Menu,
  X,
  Settings,
  MessageSquare
} from 'lucide-react';

const APP_VERSION = 'v3.1.5';

// Navigation items
const navigation = [
  { name: '대시보드', href: '/tablet', icon: LayoutDashboard },
  { name: '출석체크', href: '/tablet/attendance', icon: CalendarCheck },
  { name: '학생조회', href: '/tablet/students', icon: Users },
  { name: '결제확인', href: '/tablet/payments', icon: CreditCard },
  { name: '스케줄', href: '/tablet/schedule', icon: Calendar },
  { name: '상담예약', href: '/tablet/consultations', icon: MessageSquare, adminOnly: true },
  { name: '설정', href: '/tablet/settings', icon: Settings, adminOnly: true },
];

// Bottom tab items (세로 모드용 - 5개)
const bottomTabs = [
  { name: '대시보드', href: '/tablet', icon: LayoutDashboard },
  { name: '출석체크', href: '/tablet/attendance', icon: CalendarCheck },
  { name: '학생', href: '/tablet/students', icon: Users },
  { name: '결제', href: '/tablet/payments', icon: CreditCard },
  { name: '더보기', href: '#more', icon: Menu },
];

// 역할 표시명 매핑
const getRoleDisplayName = (role?: string, position?: string | null): string => {
  if (position) return position;
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role?: string; position?: string | null } | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // 태블릿용 manifest 설정 (가로 모드 고정)
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    let academyName = 'P-ACA';

    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        academyName = userData.academy?.name || userData.academy_name || 'P-ACA';
      } catch { /* ignore */ }
    }

    // 기존 manifest 링크 제거
    const existingLink = document.querySelector('link[rel="manifest"]');
    if (existingLink) {
      existingLink.remove();
    }

    // 태블릿용 manifest 링크 추가
    const newLink = document.createElement('link');
    newLink.rel = 'manifest';
    newLink.href = `/api/manifest?name=${encodeURIComponent(academyName)}&tablet=true`;
    document.head.appendChild(newLink);
  }, []);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
    } else {
      setUser(currentUser);
    }
  }, []);

  useEffect(() => {
    const updateOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    };

    const handleResize = () => {
      // 태블릿에서 orientationchange 후 약간의 딜레이가 필요할 수 있음
      setTimeout(updateOrientation, 100);
    };

    // 초기 설정
    updateOrientation();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Screen Orientation API 지원 시 추가 리스너
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleResize);
      }
    };
  }, []);

  const handleLogout = () => {
    authAPI.logout();
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const currentPage = navigation.find(n =>
    pathname === n.href || (n.href !== '/tablet' && pathname.startsWith(n.href + '/'))
  );

  // 가로 모드 레이아웃
  if (orientation === 'landscape') {
    return (
      <OrientationContext.Provider value={orientation}>
        <div className="min-h-screen flex bg-slate-100">
          {/* 축소형 사이드바 */}
          <aside className="w-20 bg-[#1a2b4a] text-white flex flex-col fixed h-full z-20 pb-4">
            {/* 로고 */}
            <div className="h-16 flex items-center justify-center border-b border-[#243a5e]">
              <Image
                src="/icons/icon-96x96.png"
                alt="P-ACA"
                width={48}
                height={48}
                className="rounded-xl"
              />
            </div>

            {/* 네비게이션 */}
            <nav className="flex-1 py-4 overflow-y-auto">
              <div className="space-y-1 px-2">
                {navigation
                  .filter(item => !item.adminOnly || isAdmin)
                  .map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/tablet' && pathname.startsWith(item.href + '/'));
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex flex-col items-center py-3 px-1 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-500/15 text-orange-400'
                            : 'text-slate-300 hover:bg-[#243a5e] hover:text-white'
                        }`}
                        title={item.name}
                      >
                        <item.icon size={22} />
                        <span className="text-[10px] mt-1 text-center leading-tight">{item.name}</span>
                      </Link>
                    );
                  })}
              </div>
            </nav>

            {/* 사용자 & 로그아웃 */}
            <div className="border-t border-[#243a5e] p-2">
              <button
                onClick={handleLogout}
                className="flex flex-col items-center py-2 px-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#243a5e] transition w-full"
                title="로그아웃"
              >
                <LogOut size={20} />
                <span className="text-[10px] mt-1">로그아웃</span>
              </button>
              <p className="text-[8px] text-slate-500 text-center mt-2">{APP_VERSION}</p>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1 ml-20">
            {/* 헤더 */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
              <h1 className="text-lg font-bold text-slate-800">
                {currentPage?.name || 'P-ACA 태블릿'}
              </h1>
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{getRoleDisplayName(user.role, user.position)}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0)}
                  </div>
                </div>
              )}
            </header>

            {/* 페이지 콘텐츠 */}
            <div className="p-6 pb-12 min-h-[calc(100vh-56px)]">
              {children}
            </div>
          </main>
        </div>
      </OrientationContext.Provider>
    );
  }

  // 세로 모드 레이아웃
  return (
    <OrientationContext.Provider value={orientation}>
      <div className="min-h-screen flex flex-col bg-slate-100">
        {/* 헤더 */}
        <header className="h-16 bg-[#1a2b4a] flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Image
              src="/icons/icon-96x96.png"
              alt="P-ACA"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <div>
              <h1 className="text-white font-bold">P-ACA</h1>
              <p className="text-[10px] text-slate-400">{APP_VERSION}</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-[10px] text-slate-400">{getRoleDisplayName(user.role, user.position)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
            </div>
          )}
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 pb-40 overflow-y-auto">
          {children}
        </main>

        {/* 하단 탭 바 */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 pt-2 pb-8 z-20" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {bottomTabs.map((tab) => {
            if (tab.href === '#more') {
              return (
                <button
                  key={tab.name}
                  onClick={() => setShowMoreMenu(true)}
                  className="flex flex-col items-center justify-center py-2 px-3 min-w-[64px] text-slate-400"
                >
                  <tab.icon size={24} />
                  <span className="text-xs mt-1">{tab.name}</span>
                </button>
              );
            }
            const isActive = pathname === tab.href ||
              (tab.href !== '/tablet' && pathname.startsWith(tab.href + '/'));
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 px-3 min-w-[64px] ${
                  isActive ? 'text-blue-500' : 'text-slate-400'
                }`}
              >
                <tab.icon size={24} />
                <span className="text-xs mt-1">{tab.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* 더보기 메뉴 모달 */}
        {showMoreMenu && (
          <div className="fixed inset-0 bg-black/50 z-30 flex items-end" onClick={() => setShowMoreMenu(false)}>
            <div
              className="bg-white w-full rounded-t-2xl p-4 pb-8 safe-area-pb"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">메뉴</h2>
                <button onClick={() => setShowMoreMenu(false)} className="p-2 text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {navigation
                  .filter(item => !item.adminOnly || isAdmin)
                  .map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/tablet' && pathname.startsWith(item.href + '/'));
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setShowMoreMenu(false)}
                        className={`flex flex-col items-center p-4 rounded-xl transition ${
                          isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <item.icon size={28} />
                        <span className="text-xs mt-2 text-center">{item.name}</span>
                      </Link>
                    );
                  })}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleLogout();
                  }}
                  className="flex flex-col items-center p-4 rounded-xl bg-red-50 text-red-600"
                >
                  <LogOut size={28} />
                  <span className="text-xs mt-2">로그아웃</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrientationContext.Provider>
  );
}
