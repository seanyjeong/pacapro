'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, User, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib/api/auth';

// 역할을 한글로 변환
const getRoleLabel = (role: string, position?: string): string => {
    // position이 있으면 우선 표시 (staff의 직급)
    if (position) return position;

    switch (role) {
        case 'owner': return '원장';
        case 'admin': return '시스템 관리자';
        case 'staff': return '직원';
        case 'teacher': return '강사';
        default: return '사용자';
    }
};

export function TopNav() {
    const [user, setUser] = useState<any>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        const currentUser = authAPI.getCurrentUser();
        setUser(currentUser);
    }, []);

    const handleLogout = () => {
        authAPI.logout();
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 md:left-64 z-10 no-print">
            <div className="h-full px-4 md:px-6 flex items-center justify-between">
                {/* Left: Mobile Menu + Search */}
                <div className="flex items-center space-x-4 flex-1">
                    {/* Mobile Menu Button */}
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="w-5 h-5" />
                    </Button>

                    {/* Search Bar */}
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="학생, 강사, 전화번호 검색..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Right: Notifications + User */}
                <div className="flex items-center space-x-4">
                    {/* Notifications */}
                    <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="hidden md:block text-left">
                                <div className="text-sm font-medium text-gray-900">
                                    {user?.name || '사용자'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {user ? getRoleLabel(user.role, user.position) : '사용자'}
                                </div>
                            </div>
                        </button>

                        {/* User Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>로그아웃</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
