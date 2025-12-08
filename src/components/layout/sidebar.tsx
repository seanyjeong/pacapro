'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
    LayoutDashboard,
    Users,
    UserCog,
    Calendar,
    CreditCard,
    Wallet,
    Trophy,
    Receipt,
    TrendingUp,
    BarChart3,
    Settings,
    Shield,
    Award,
    UserCheck,
    Building2,
    MessageSquare,
    PhoneCall,
} from 'lucide-react';
import type { Permissions } from '@/lib/types/staff';
import apiClient from '@/lib/api/client';

interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    permissionKey?: string; // 권한 체크를 위한 키
    ownerOnly?: boolean; // 원장만 볼 수 있는 메뉴
}

const navItems: NavItem[] = [
    { title: '대시보드', href: '/', icon: LayoutDashboard },
    { title: '학생', href: '/students', icon: Users, permissionKey: 'students' },
    { title: '강사', href: '/instructors', icon: UserCog, permissionKey: 'instructors' },
    { title: '수업', href: '/schedules', icon: Calendar, permissionKey: 'schedules' },
    { title: '학원비', href: '/payments', icon: CreditCard, permissionKey: 'payments' },
    { title: '급여', href: '/salaries', icon: Wallet, permissionKey: 'salaries' },
    { title: '시즌', href: '/seasons', icon: Trophy, permissionKey: 'seasons' },
    { title: '지출', href: '/expenses', icon: Receipt, permissionKey: 'expenses' },
    { title: '수입', href: '/incomes', icon: TrendingUp, permissionKey: 'incomes' },
    { title: '성적기록 (추후)', href: '/performance', icon: Award },
    { title: '리포트', href: '/reports', icon: BarChart3, permissionKey: 'reports' },
    { title: '상담', href: '/consultations', icon: PhoneCall, permissionKey: 'settings' },
    { title: '문자 보내기', href: '/sms', icon: MessageSquare, permissionKey: 'settings' },
    { title: '직원관리', href: '/staff', icon: UserCheck, ownerOnly: true },
    { title: '설정', href: '/settings', icon: Settings, permissionKey: 'settings' },
];

const adminNavItems: NavItem[] = [
    { title: '사용자 승인', href: '/admin/users', icon: Shield },
];

interface UserState {
    role: string;
    permissions: Permissions;
}

export function Sidebar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<UserState | null>(null);
    const [academyName, setAcademyName] = useState<string>('');

    // 클라이언트에서만 사용자 정보 로드 (hydration 문제 방지)
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const userData = JSON.parse(userStr);
                setUser({
                    role: userData.role || '',
                    permissions: userData.permissions || {},
                });
            } catch {
                setUser(null);
            }
        }
        setMounted(true);

        // 학원명 로드
        loadAcademyName();
    }, []);

    const loadAcademyName = async () => {
        try {
            const response = await apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy');
            if (response.settings?.academy_name) {
                setAcademyName(response.settings.academy_name);
            }
        } catch (err) {
            // 로그인 안된 상태에서는 에러 무시
        }
    };

    const isAdmin = user?.role === 'admin';
    const isOwner = user?.role === 'owner';
    const isStaff = user?.role === 'staff';
    const permissions: Permissions = user?.permissions || {};

    // 메뉴 접근 가능 여부 확인
    const canAccessMenu = (item: NavItem): boolean => {
        // 마운트 전에는 모든 메뉴 표시 (hydration 문제 방지)
        if (!mounted) return true;

        // 원장은 모든 메뉴 접근 가능
        if (isOwner) return true;

        // admin(시스템 관리자)은 모든 메뉴 접근 가능
        if (isAdmin) return true;

        // 원장 전용 메뉴는 staff 접근 불가
        if (item.ownerOnly && isStaff) return false;

        // 권한 키가 없는 메뉴는 모두 접근 가능
        if (!item.permissionKey) return true;

        // staff는 권한 체크
        if (isStaff) {
            const perm = permissions[item.permissionKey as keyof Permissions];
            return perm?.view === true;
        }

        return true;
    };

    return (
        <aside className="hidden md:flex md:w-64 md:flex-col fixed left-0 top-0 h-full bg-white border-r border-gray-200 no-print">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">P</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">P-ACA</span>
                </Link>
            </div>

            {/* Academy Name */}
            {academyName && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-primary-500 flex-shrink-0" />
                        <span className="text-base font-bold text-gray-800 truncate">{academyName}</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {/* Main Menu */}
                <ul className="space-y-1">
                    {navItems.filter(canAccessMenu).map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    )}
                                >
                                    <Icon className={cn('w-5 h-5', isActive ? 'text-primary-600' : 'text-gray-500')} />
                                    <span>{item.title}</span>
                                    {item.badge && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {/* Admin Menu (Admin only) */}
                {mounted && isAdmin && (
                    <div className="mt-6">
                        <div className="px-3 mb-2">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">개발자 전용</h3>
                        </div>
                        <ul className="space-y-1">
                            {adminNavItems.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                const Icon = item.icon;

                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-purple-50 text-purple-700'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            )}
                                        >
                                            <Icon
                                                className={cn('w-5 h-5', isActive ? 'text-purple-600' : 'text-gray-500')}
                                            />
                                            <span>{item.title}</span>
                                            {item.badge && (
                                                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
                <div className="text-xs text-gray-500 text-center space-y-1">
                    <div>P-ACA v2.5.8</div>
                    <div className="text-[10px] text-gray-400">Last updated: 2025-12-08</div>
                    <div>문의: 010-2144-6755</div>
                </div>
            </div>
        </aside>
    );
}
