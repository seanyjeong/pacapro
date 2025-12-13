'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit, canView } from '@/lib/utils/permissions';
import { UserCheck, Users, CreditCard, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function MobileHomePage() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [academyName, setAcademyName] = useState<string>('');

  useEffect(() => {
    // 로그인 체크
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // 사용자 정보 로드
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserName(user.name || user.username || '');
        setAcademyName(user.academy?.name || user.academy_name || '');
      } catch {
        // ignore
      }
    }

    // 권한 체크: schedules.edit 또는 payments.view 중 하나라도 있으면 접근 가능
    const canAccess = canEdit('schedules') || canView('payments');
    setHasPermission(canAccess);

    if (!canAccess) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  const menuItems = [
    {
      href: '/m/attendance',
      icon: UserCheck,
      label: '학생 출석체크',
      description: '날짜/시간대별 출석 관리',
      iconBg: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/instructor',
      icon: Users,
      label: '강사 출근체크',
      description: '강사 출퇴근 기록',
      iconBg: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/unpaid',
      icon: CreditCard,
      label: '미납자 확인',
      description: '미납 학생 목록 조회',
      iconBg: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      permission: canView('payments'),
    },
  ];

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const weekdayStr = today.toLocaleDateString('ko-KR', { weekday: 'long' });

  return (
    <div className="min-h-screen bg-background p-5 safe-area-inset">
      {/* 헤더 */}
      <header className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Image
              src="/icons/icon-96x96.png"
              alt="P-ACA"
              width={56}
              height={56}
              className="rounded-xl"
            />
          </div>
        </div>
        {academyName && (
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{academyName}</h1>
        )}
        {userName && (
          <p className="text-muted-foreground mt-1">{userName}님 안녕하세요</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {dateStr} <span className="text-primary font-medium">{weekdayStr}</span>
        </p>
      </header>

      {/* 메뉴 버튼 */}
      <div className="space-y-3">
        {menuItems.map((item) => {
          if (!item.permission) return null;

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="w-full bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4
                         shadow-sm hover:shadow-md hover:border-border
                         active:scale-[0.98] transition-all duration-200 group"
            >
              <div className={`p-3.5 rounded-xl ${item.iconBg}`}>
                <item.icon className={`h-6 w-6 ${item.iconColor}`} />
              </div>
              <div className="text-left flex-1">
                <span className="text-lg font-semibold text-foreground block">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>

      {/* 로그아웃 버튼 */}
      <div className="mt-10">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full py-6 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5 mr-2" />
          로그아웃
        </Button>
      </div>

      {/* 버전 정보 */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground/60">P-ACA Mobile v2.9.17</p>
      </div>
    </div>
  );
}
