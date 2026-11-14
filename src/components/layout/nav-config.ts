import type React from 'react';
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
    MessageSquare,
    PhoneCall,
    BellRing,
    CalendarDays,
    CalendarCog,
} from 'lucide-react';
import type { Permissions } from '@/lib/types/staff';
import { ILSAN_ACADEMY_ID } from '@/constants/ilsan-admission';

export interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    permissionKey?: string;
    ownerOnly?: boolean;
}

export interface NavCategory {
    title: string;
    items: NavItem[];
}

// 사이드바·휴대폰 전체 메뉴가 함께 쓰는 메뉴 구조
export const navCategories: NavCategory[] = [
    {
        title: '학원 운영',
        items: [
            { title: '학생', href: '/students', icon: Users, permissionKey: 'students' },
            { title: '입학원서', href: '/admissions', icon: UserCheck, permissionKey: 'students' },
            { title: '강사', href: '/instructors', icon: UserCog, permissionKey: 'instructors' },
            { title: '수업스케줄', href: '/schedules', icon: Calendar, permissionKey: 'schedules' },
            { title: '수업일관리', href: '/students/class-days', icon: CalendarCog, permissionKey: 'class_days' },
            { title: '학원일정', href: '/academy-events', icon: CalendarDays, permissionKey: 'academy_events' },
            { title: '시즌', href: '/seasons', icon: Trophy, permissionKey: 'seasons' },
            { title: '성적관리', href: '/performance', icon: Award, permissionKey: 'students' },
        ],
    },
    {
        title: '재무',
        items: [
            { title: '학원비', href: '/payments', icon: CreditCard, permissionKey: 'payments' },
            { title: '크레딧', href: '/payments/credits', icon: Wallet, permissionKey: 'payments' },
            { title: '급여', href: '/salaries', icon: Wallet, permissionKey: 'salaries' },
            { title: '지출', href: '/expenses', icon: Receipt, permissionKey: 'expenses' },
            { title: '수입', href: '/incomes', icon: TrendingUp, permissionKey: 'incomes' },
            { title: '리포트', href: '/reports', icon: BarChart3, permissionKey: 'reports' },
        ],
    },
    {
        title: '상담·연락',
        items: [
            { title: '신규상담', href: '/consultations/new-inquiry', icon: PhoneCall, permissionKey: 'consultations' },
            { title: '재원생상담', href: '/consultations/enrolled', icon: Users, permissionKey: 'consultations' },
            { title: '문자 보내기', href: '/sms', icon: MessageSquare, permissionKey: 'sms' },
            { title: '알림톡 설정', href: '/settings/notifications', icon: BellRing, permissionKey: 'notifications' },
        ],
    },
    {
        title: '관리',
        items: [
            { title: '직원관리', href: '/staff', icon: UserCheck, ownerOnly: true },
            { title: '설정', href: '/settings', icon: Settings, permissionKey: 'settings' },
        ],
    },
];

export const dashboardItem: NavItem = { title: '대시보드', href: '/', icon: LayoutDashboard };

export const adminNavItems: NavItem[] = [
    { title: '사용자 승인', href: '/admin/users', icon: Shield },
];

export interface NavUser {
    role: string;
    permissions: Permissions;
    academyId?: number;
    academy_id?: number;
}

export function readNavUser(): NavUser | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        const userData = JSON.parse(userStr);
        return {
            role: userData.role || '',
            permissions: userData.permissions || {},
            academyId: userData.academyId,
            academy_id: userData.academy_id,
        };
    } catch {
        return null;
    }
}

export function isNavAdmin(user: NavUser | null): boolean {
    return user?.role === 'admin' || (user?.role === 'owner' && Number(user?.academyId ?? user?.academy_id) === 1);
}

// 메뉴 접근 가능 여부 (마운트 전에는 모든 메뉴 표시 — hydration 문제 방지)
export function canAccessNavItem(item: NavItem, user: NavUser | null, mounted: boolean): boolean {
    const isStaff = user?.role === 'staff';
    const permissions: Permissions = user?.permissions || {};
    if (item.href === '/admissions' && (!mounted || Number(user?.academyId ?? user?.academy_id) !== ILSAN_ACADEMY_ID || (isStaff && permissions.students?.edit !== true))) return false;
    if (!mounted) return true;
    if (user?.role === 'owner' || isNavAdmin(user)) return true;
    if (item.ownerOnly && isStaff) return false;
    if (!item.permissionKey) return true;
    if (isStaff) {
        const perm = permissions[item.permissionKey as keyof Permissions];
        return perm?.view === true;
    }
    return true;
}

function matchesPath(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
}

// 지금 주소에 가장 가깝게 맞는 메뉴 하나만 선택 표시한다 (/payments/credits 에서 학원비까지 켜지지 않게).
export function findActiveHref(pathname: string): string | null {
    const hrefs = [dashboardItem, ...adminNavItems, ...navCategories.flatMap((category) => category.items)].map((item) => item.href);
    return hrefs.filter((href) => matchesPath(pathname, href)).sort((a, b) => b.length - a.length)[0] ?? null;
}
