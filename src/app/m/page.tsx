'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canEdit, canView } from '@/lib/utils/permissions';
import { UserCheck, Users, CreditCard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function MobileHomePage() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
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
      color: 'bg-blue-500 hover:bg-blue-600',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/instructor',
      icon: Users,
      label: '강사 출근체크',
      description: '강사 출퇴근 기록',
      color: 'bg-green-500 hover:bg-green-600',
      permission: canEdit('schedules'),
    },
    {
      href: '/m/unpaid',
      icon: CreditCard,
      label: '미납자 확인',
      description: '미납 목록 + 전화걸기',
      color: 'bg-red-500 hover:bg-red-600',
      permission: canView('payments'),
    },
  ];

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4 safe-area-inset">
      {/* 헤더 */}
      <header className="mb-6 text-center">
        <div className="flex justify-center mb-3">
          <Image
            src="/icons/icon-96x96.png"
            alt="P-ACA"
            width={64}
            height={64}
            className="rounded-xl shadow-md"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">P-ACA 모바일</h1>
        {userName && (
          <p className="text-gray-600 mt-1">{userName}님 안녕하세요</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{today}</p>
      </header>

      {/* 메뉴 버튼 */}
      <div className="space-y-4">
        {menuItems.map((item) => {
          if (!item.permission) return null;

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full ${item.color} text-white rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-all`}
            >
              <div className="bg-white/20 p-3 rounded-xl">
                <item.icon className="h-7 w-7" />
              </div>
              <div className="text-left">
                <span className="text-lg font-semibold block">{item.label}</span>
                <span className="text-sm text-white/80">{item.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 로그아웃 버튼 */}
      <div className="mt-8">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full py-6 text-gray-600 border-gray-300"
        >
          <LogOut className="h-5 w-5 mr-2" />
          로그아웃
        </Button>
      </div>

      {/* 웹 버전 링크 */}
      <div className="mt-4 text-center">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-blue-500 underline"
        >
          웹 버전으로 이동
        </button>
      </div>
    </div>
  );
}
