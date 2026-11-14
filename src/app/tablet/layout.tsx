'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';
import { OrientationContext } from '@/components/tablet/orientation-context';
import {
  Users,
  CalendarCheck,
  CreditCard,
  Calendar,
  LogOut,
  Menu,
  X,
  Settings,
  MessageSquare,
  Mountain,
  Send,
  Monitor
} from 'lucide-react';
import releaseInfo from '@/constants/release.json';
import { openPeakSso } from '@/lib/peak-sso';

const APP_VERSION = `v${releaseInfo.version}`;

// Navigation items (대시보드 제거)
const navigation = [
  { name: '출석체크', href: '/tablet/attendance', icon: CalendarCheck },
  { name: '학생조회', href: '/tablet/students', icon: Users },
  { name: '결제확인', href: '/tablet/payments', icon: CreditCard },
  { name: '스케줄', href: '/tablet/schedule', icon: Calendar },
  { name: '상담예약', href: '/tablet/consultations', icon: MessageSquare },
  { name: '문자', href: '/tablet/sms', icon: Send },
  { name: 'PC버전', href: '/', icon: Monitor, ownerOnly: true },
  { name: '설정', href: '/tablet/settings', icon: Settings, adminOnly: true },
];

// Bottom tab items (세로 모드용 - 5개, 대시보드 제거)
const bottomTabs = [
  { name: '출석체크', href: '/tablet/attendance', icon: CalendarCheck },
  { name: '학생', href: '/tablet/students', icon: Users },
  { name: '결제', href: '/tablet/payments', icon: CreditCard },
  { name: '상담', href: '/tablet/consultations', icon: MessageSquare },
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
  const isOwner = user?.role === 'owner';

  const visibleNavigation = navigation.filter(item => (!item.adminOnly || isAdmin) && (!item.ownerOnly || isOwner));
  const isActiveHref = (href: string) => pathname === href || (href !== '/tablet' && pathname.startsWith(href + '/'));
  const openPcMode = () => {
    document.cookie = 'force_pc_mode=true; path=/; max-age=86400';
    window.location.href = '/';
  };

  // 가로 모드 레이아웃
  if (orientation === 'landscape') {
    return (
      <OrientationContext.Provider value={orientation}>
        <div className="flex min-h-screen bg-background">
          {/* 사이드 메뉴 - 좁은 아이콘 줄(표가 넓게 보이도록), PC 사이드바와 같은 색·모양 */}
          <aside className="fixed inset-y-0 left-0 z-20 flex w-[88px] flex-col bg-card">
            <div className="flex h-16 shrink-0 items-center justify-center">
              <Image
                src="/icons/icon-96x96.png"
                alt="P-ACA"
                width={40}
                height={40}
                className="rounded-xl"
              />
            </div>

            <nav aria-label="태블릿 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <ul className="space-y-1">
                {visibleNavigation.map((item) => {
                  const isActive = isActiveHref(item.href);
                  const className = `flex min-h-[54px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] leading-tight transition-colors ${
                    isActive ? 'bg-muted font-bold text-foreground' : 'font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`;
                  const icon = <item.icon className={`h-[22px] w-[22px] ${isActive ? 'text-primary' : ''}`} />;

                  // PC버전은 쿠키 설정 후 이동
                  if (item.name === 'PC버전') {
                    return (
                      <li key={item.name}>
                        <button type="button" onClick={openPcMode} className={className} title={item.name}>
                          {icon}
                          <span className="text-center">{item.name}</span>
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={item.name}>
                      <Link href={item.href} aria-current={isActive ? 'page' : undefined} className={className} title={item.name}>
                        {icon}
                        <span className="text-center">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* P-EAK · 사용자 · 로그아웃 */}
            <div className="shrink-0 space-y-1 border-t border-border/60 px-2 pb-3 pt-2">
              <button
                type="button"
                onClick={() => { void openPeakSso(); }}
                className="flex min-h-[50px] w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-warning transition-colors hover:bg-warning-soft"
                title="P-EAK 실기관리"
              >
                <Mountain className="h-5 w-5" />
                P-EAK
              </button>
              {user && (
                <div
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                  title={`${user.name} · ${getRoleDisplayName(user.role, user.position)}`}
                  aria-label={`${user.name} ${getRoleDisplayName(user.role, user.position)}`}
                >
                  {user.name.charAt(0)}
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[50px] w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="로그아웃"
              >
                <LogOut className="h-5 w-5" />
                로그아웃
              </button>
              <p className="text-center text-[10px] text-muted-foreground/80">{APP_VERSION}</p>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="ml-[88px] min-w-0 flex-1">
            <div className="mx-auto min-h-screen w-full max-w-[1280px] px-6 pb-12 pt-5">
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
      <div className="flex min-h-screen flex-col bg-background">
        {/* 위 줄 */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-background/95 px-5 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Image
              src="/icons/icon-96x96.png"
              alt="P-ACA"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <div>
              <h1 className="text-[17px] font-extrabold leading-tight tracking-tight text-foreground">P-ACA</h1>
              <p className="text-[11px] text-muted-foreground">{APP_VERSION}</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{getRoleDisplayName(user.role, user.position)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                {user.name.charAt(0)}
              </div>
            </div>
          )}
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto px-5 pb-40 pt-2">
          {children}
        </main>

        {/* 아래 탭 */}
        <nav
          aria-label="아래 메뉴"
          className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-border/60 bg-card/95 px-2 backdrop-blur"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {bottomTabs.map((tab) => {
            if (tab.href === '#more') {
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => setShowMoreMenu(true)}
                  aria-expanded={showMoreMenu}
                  className={`flex h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 text-xs font-semibold ${showMoreMenu ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  <tab.icon className={`h-6 w-6 ${showMoreMenu ? 'text-primary' : ''}`} />
                  {tab.name}
                </button>
              );
            }
            const isActive = !showMoreMenu && isActiveHref(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <tab.icon className={`h-6 w-6 ${isActive ? 'text-primary' : ''}`} />
                {tab.name}
              </Link>
            );
          })}
        </nav>

        {/* 더보기 메뉴 - 아래에서 올라오는 시트 */}
        {showMoreMenu && (
          <div className="fixed inset-0 z-30 flex items-end bg-black/40 backdrop-blur-[2px]" onClick={() => setShowMoreMenu(false)}>
            <div
              className="w-full rounded-t-3xl bg-card px-5 pb-8 pt-3"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="메뉴"
            >
              <div className="flex justify-center pb-2">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-foreground">메뉴</h2>
                <button type="button" onClick={() => setShowMoreMenu(false)} aria-label="메뉴 닫기" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {visibleNavigation.map((item) => {
                  const isActive = isActiveHref(item.href);
                  const className = `flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-primary-soft text-primary' : 'bg-muted text-foreground hover:bg-muted/70'
                  }`;

                  // PC버전은 쿠키 설정 후 이동
                  if (item.name === 'PC버전') {
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          openPcMode();
                        }}
                        className={className}
                      >
                        <item.icon className="h-7 w-7" />
                        <span className="text-center">{item.name}</span>
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setShowMoreMenu(false)}
                      className={className}
                    >
                      <item.icon className="h-7 w-7" />
                      <span className="text-center">{item.name}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    void openPeakSso();
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-warning-soft p-4 text-sm font-semibold text-warning"
                >
                  <Mountain className="h-7 w-7" />
                  P-EAK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleLogout();
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-destructive-soft p-4 text-sm font-semibold text-destructive"
                >
                  <LogOut className="h-7 w-7" />
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrientationContext.Provider>
  );
}
