'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import packageJson from '../../../package.json';
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
    Bell,
    BellOff,
    Loader2,
    GraduationCap,
    CircleDollarSign,
    MessageCircle,
    Cog,
    BellRing,
    CalendarDays,
    PanelLeftClose,
    PanelLeft,
    CalendarCog,
} from 'lucide-react';
import type { Permissions } from '@/lib/types/staff';
import apiClient from '@/lib/api/client';
import {
    pushAPI,
    isPushSupported,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    getCurrentSubscription,
} from '@/lib/api/push';
import { SidebarNavigation } from './sidebar-navigation';
import { PeakShortcutButton } from './peak-shortcut-button';

interface NavItem {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    permissionKey?: string;
    ownerOnly?: boolean;
}

interface NavCategory {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: NavItem[];
    defaultOpen?: boolean;
}

// 카테고리별 메뉴 구조
const navCategories: NavCategory[] = [
    {
        title: '학원 운영',
        icon: GraduationCap,
        defaultOpen: true,
        items: [
            { title: '학생', href: '/students', icon: Users, permissionKey: 'students' },
            { title: '강사', href: '/instructors', icon: UserCog, permissionKey: 'instructors' },
            { title: '수업스케줄', href: '/schedules', icon: Calendar, permissionKey: 'schedules' },
            { title: '수업일관리', href: '/students/class-days', icon: CalendarCog, permissionKey: 'class_days' },
            { title: '학원일정', href: '/academy-events', icon: CalendarDays, permissionKey: 'academy_events' },
            { title: '시즌', href: '/seasons', icon: Trophy, permissionKey: 'seasons' },
            { title: '성적관리', href: '/performance', icon: Award, permissionKey: 'students' },
        ],
    },
    {
        title: '재무 관리',
        icon: CircleDollarSign,
        defaultOpen: true,
        items: [
            { title: '학원비', href: '/payments', icon: CreditCard, permissionKey: 'payments' },
            { title: '크레딧 관리', href: '/payments/credits', icon: Wallet, permissionKey: 'payments' },
            { title: '급여', href: '/salaries', icon: Wallet, permissionKey: 'salaries' },
            { title: '지출', href: '/expenses', icon: Receipt, permissionKey: 'expenses' },
            { title: '수입', href: '/incomes', icon: TrendingUp, permissionKey: 'incomes' },
            { title: '리포트', href: '/reports', icon: BarChart3, permissionKey: 'reports' },
        ],
    },
    {
        title: '커뮤니케이션',
        icon: MessageCircle,
        defaultOpen: false,
        items: [
            { title: '신규상담', href: '/consultations/new-inquiry', icon: PhoneCall, permissionKey: 'consultations' },
            { title: '재원생상담', href: '/consultations/enrolled', icon: Users, permissionKey: 'consultations' },
            { title: '문자 보내기', href: '/sms', icon: MessageSquare, permissionKey: 'sms' },
            { title: '알림톡 설정', href: '/settings/notifications', icon: BellRing, permissionKey: 'notifications' },
        ],
    },
    {
        title: '관리',
        icon: Cog,
        defaultOpen: false,
        items: [
            { title: '직원관리', href: '/staff', icon: UserCheck, ownerOnly: true },
            { title: '설정', href: '/settings', icon: Settings, permissionKey: 'settings' },
        ],
    },
];

// 대시보드는 별도 (항상 상단)
const dashboardItem: NavItem = { title: '대시보드', href: '/', icon: LayoutDashboard };

const adminNavItems: NavItem[] = [
    { title: '사용자 승인', href: '/admin/users', icon: Shield },
];

interface UserState {
    role: string;
    permissions: Permissions;
    academyId?: number;
    academy_id?: number;
}

export function Sidebar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<UserState | null>(null);
    const [academyName, setAcademyName] = useState<string>('');

    // 사이드바 접힘 상태
    const [collapsed, setCollapsed] = useState(false); // 기본값: 펼침

    // 푸시 알림 상태
    const [pushSupported, setPushSupported] = useState(false);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    // 카테고리 펼침 상태
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // 상담 카운트 (pending + scheduled 상태)
    const [consultationCounts, setConsultationCounts] = useState({
        newInquiry: 0,
        enrolled: 0
    });

    // 클라이언트에서만 사용자 정보 로드 (hydration 문제 방지)
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const userData = JSON.parse(userStr);
                setUser({
                    role: userData.role || '',
                    permissions: userData.permissions || {},
                    academyId: userData.academyId,
                    academy_id: userData.academy_id,
                });
            } catch {
                setUser(null);
            }
        }
        setMounted(true);

        // 사이드바 접힘 상태 로드
        const savedCollapsed = localStorage.getItem('sidebar_collapsed');
        if (savedCollapsed !== null) {
            setCollapsed(savedCollapsed === 'true');
        }

        // 학원명 로드
        loadAcademyName();

        // 푸시 알림 상태 체크
        checkPushStatus();

        // 상담 카운트 로드
        loadConsultationCounts();

        // 저장된 카테고리 상태 로드 또는 기본값 설정
        const savedState = localStorage.getItem('sidebar_expanded');
        if (savedState) {
            setExpandedCategories(JSON.parse(savedState));
        } else {
            // 기본 펼침 상태 설정
            const defaultState: Record<string, boolean> = {};
            navCategories.forEach(cat => {
                defaultState[cat.title] = cat.defaultOpen ?? false;
            });
            setExpandedCategories(defaultState);
        }
    }, []);

    // 현재 경로에 맞는 카테고리 자동 펼침
    useEffect(() => {
        if (!mounted) return;

        navCategories.forEach(category => {
            const hasActiveItem = category.items.some(
                item => pathname === item.href || pathname.startsWith(item.href + '/')
            );
            if (hasActiveItem) {
                setExpandedCategories(prev => {
                    const newState = { ...prev, [category.title]: true };
                    localStorage.setItem('sidebar_expanded', JSON.stringify(newState));
                    return newState;
                });
            }
        });
    }, [pathname, mounted]);

    const toggleCategory = (title: string) => {
        setExpandedCategories(prev => {
            const newState = { ...prev, [title]: !prev[title] };
            localStorage.setItem('sidebar_expanded', JSON.stringify(newState));
            return newState;
        });
    };

    const toggleCollapsed = () => {
        const newValue = !collapsed;
        setCollapsed(newValue);
        localStorage.setItem('sidebar_collapsed', String(newValue));
    };

    const checkPushStatus = async () => {
        const supported = isPushSupported();
        setPushSupported(supported);
        if (supported) {
            const subscription = await getCurrentSubscription();
            setPushSubscribed(!!subscription);
        }
    };

    // 상담 카운트 로드 (pending, scheduled 상태만)
    const loadConsultationCounts = async () => {
        try {
            const [newRes, enrolledRes] = await Promise.all([
                apiClient.get<{ pagination: { total: number } }>('/consultations?consultationType=new_registration&status=pending,scheduled&limit=1'),
                apiClient.get<{ pagination: { total: number } }>('/consultations?consultationType=learning&status=pending,scheduled&limit=1')
            ]);
            setConsultationCounts({
                newInquiry: newRes.pagination?.total || 0,
                enrolled: enrolledRes.pagination?.total || 0
            });
        } catch (error) {
            console.error('상담 카운트 로드 실패:', error);
        }
    };

    const handlePushToggle = async () => {
        setPushLoading(true);
        try {
            if (pushSubscribed) {
                const subscription = await getCurrentSubscription();
                if (subscription?.endpoint) {
                    await pushAPI.unsubscribe(subscription.endpoint);
                }
                await unsubscribeFromPush();
                setPushSubscribed(false);
            } else {
                const perm = await requestNotificationPermission();
                if (perm !== 'granted') {
                    toast.error('알림 권한이 꺼져 있습니다. 브라우저 설정에서 알림 권한을 허용해주세요.');
                    return;
                }
                const vapidPublicKey = await pushAPI.getVapidPublicKey();
                const subscription = await subscribeToPush(vapidPublicKey);
                if (subscription) {
                    await pushAPI.subscribe(subscription, 'PC');
                    setPushSubscribed(true);
                }
            }
        } catch (error) {
            console.error('푸시 설정 오류:', error);
        } finally {
            setPushLoading(false);
        }
    };

    const loadAcademyName = async () => {
        try {
            const response = await apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy');
            if (response.settings?.academy_name) {
                setAcademyName(response.settings.academy_name);
            }
        } catch {
            // 로그인 안된 상태에서는 에러 무시
        }
    };

    const isAdmin = user?.role === 'admin' || (user?.role === 'owner' && Number(user?.academyId ?? user?.academy_id) === 1);
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

    // 카테고리 내 접근 가능한 아이템이 있는지 확인
    const hasAccessibleItems = (category: NavCategory): boolean => {
        return category.items.some(item => canAccessMenu(item));
    };

    return (
        <aside
            className={cn(
                "hidden md:flex md:flex-col fixed left-0 top-0 h-full bg-card border-r border-border no-print transition-all duration-300 ease-in-out z-40",
                collapsed ? "w-[68px] overflow-visible" : "w-64"
            )}
        >
            {/* Logo */}
            <div className={cn(
                "h-16 flex items-center border-b border-border",
                collapsed ? "justify-center px-2" : "justify-between px-4"
            )}>
                <Link href="/" className="flex items-center space-x-2">
                    <Image
                        src="/icons/icon-96x96.png"
                        alt="P-ACA"
                        width={32}
                        height={32}
                        className="rounded-lg flex-shrink-0"
                    />
                    {!collapsed && <span className="text-xl font-bold text-foreground">P-ACA</span>}
                </Link>
                {/* 푸시 알림 토글 - 펼친 상태에서만 */}
                {!collapsed && mounted && pushSupported && (
                    <div className="relative group">
                        <button
                            aria-label={pushSubscribed ? '미납자 푸시 알림 끄기' : '미납자 푸시 알림 켜기'}
                            onClick={handlePushToggle}
                            disabled={pushLoading}
                            className={`p-2 rounded-lg transition-colors duration-200 ${
                                pushSubscribed
                                    ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            } disabled:opacity-50`}
                        >
                            {pushLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : pushSubscribed ? (
                                <Bell className="w-5 h-5" />
                            ) : (
                                <BellOff className="w-5 h-5" />
                            )}
                        </button>
                        {/* 툴팁 */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                            <p className="text-sm font-medium text-foreground">
                                {pushSubscribed ? '미납자 알림 ON' : '미납자 알림 OFF'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {pushSubscribed ? '클릭하여 끄기' : '클릭하여 켜기'}
                            </p>
                            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-popover border-l border-t border-border rotate-45" />
                        </div>
                    </div>
                )}
            </div>

            {/* Academy Name - 펼친 상태에서만 */}
            {!collapsed && academyName && (
                <div className="px-4 py-3 border-b border-border bg-muted">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-base font-bold text-foreground truncate">{academyName}</span>
                    </div>
                </div>
            )}

            <SidebarNavigation
                collapsed={collapsed}
                pathname={pathname}
                mounted={mounted}
                isAdmin={isAdmin}
                expandedCategories={expandedCategories}
                navCategories={navCategories}
                dashboardItem={dashboardItem}
                adminNavItems={adminNavItems}
                consultationCounts={consultationCounts}
                canAccessMenu={canAccessMenu}
                hasAccessibleItems={hasAccessibleItems}
                toggleCategory={toggleCategory}
            />

            <PeakShortcutButton collapsed={collapsed} />

            {/* 접기/펼치기 토글 버튼 */}
            <div className="px-2 pb-2">
                <button
                    onClick={toggleCollapsed}
                    className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                        "bg-muted/50 hover:bg-muted border border-border/50 hover:border-border",
                        collapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"
                    )}
                >
                    {collapsed ? (
                        <PanelLeft className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <>
                            <span className="text-muted-foreground">사이드바 접기</span>
                            <PanelLeftClose className="w-5 h-5 text-muted-foreground" />
                        </>
                    )}
                </button>
            </div>

            {/* Footer - 펼친 상태에서만 */}
            {!collapsed && (
                <div className="p-4 border-t border-border">
                    <div className="text-xs text-muted-foreground text-center space-y-1">
                        <div>P-ACA v{packageJson.version}</div>
                        <div className="text-[10px] text-muted-foreground/70">Last updated: {packageJson.lastUpdate}</div>
                        <div>문의: 010-2144-6755</div>
                    </div>
                </div>
            )}
        </aside>
    );
}
