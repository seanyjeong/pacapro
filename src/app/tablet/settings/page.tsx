'use client';

/**
 * 태블릿 설정 페이지
 * - PC 컴포넌트 재사용
 * - 간단한 사용자 정보 및 로그아웃 기능
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, RefreshCw, Settings, Info, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  academy_name: string;
}

export default function TabletSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await apiClient.get<{ user: UserInfo }>('/auth/me');
      setUser(res.user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token');
      router.push('/login');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: '원장',
      admin: '관리자',
      staff: '직원',
      instructor: '강사'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      staff: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      instructor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">설정</h1>
          <p className="text-muted-foreground">계정 및 앱 설정</p>
        </div>
      </div>

      {/* 사용자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            내 계정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">{user?.name || '사용자'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getRoleColor(user?.role || '')}>
                  {getRoleLabel(user?.role || '')}
                </Badge>
                <span className="text-sm text-muted-foreground">{user?.academy_name}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 앱 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            앱 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-3" />
            앱 새로고침
          </Button>
        </CardContent>
      </Card>

      {/* 버전 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            앱 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">버전</span>
            <span className="text-foreground font-medium">P-ACA Tablet v1.0.0</span>
          </div>
        </CardContent>
      </Card>

      {/* 로그아웃 */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4 mr-2" />
        )}
        {loggingOut ? '로그아웃 중...' : '로그아웃'}
      </Button>
    </div>
  );
}
