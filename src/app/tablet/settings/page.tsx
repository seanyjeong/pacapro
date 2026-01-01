'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import {
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 사용자 정보 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={32} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{user?.name || '사용자'}</h2>
            <p className="text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-sm rounded-full">
                {getRoleLabel(user?.role || '')}
              </span>
              <span className="text-sm text-slate-400">{user?.academy_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 설정 메뉴 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">앱 설정</h3>
        </div>

        <button
          className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition"
          onClick={() => window.location.reload()}
        >
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="text-slate-400" />
            <span className="text-slate-700">앱 새로고침</span>
          </div>
          <ChevronRight size={20} className="text-slate-300" />
        </button>
      </div>

      {/* 버전 정보 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">버전</span>
          <span className="text-slate-800">P-ACA Tablet v1.0.0</span>
        </div>
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full bg-red-500 text-white rounded-2xl p-4 shadow-sm font-medium flex items-center justify-center gap-2 active:bg-red-600 transition disabled:opacity-50"
      >
        {loggingOut ? (
          <RefreshCw className="animate-spin" size={20} />
        ) : (
          <LogOut size={20} />
        )}
        <span>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
      </button>
    </div>
  );
}
