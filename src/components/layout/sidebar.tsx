'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
    Bell,
    BellOff,
    Loader2,
    ChevronDown,
    ChevronRight,
    GraduationCap,
    CircleDollarSign,
    MessageCircle,
    Cog,
    BellRing,
    ExternalLink,
    Mountain,
    CalendarDays,
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
            { title: '학원일정', href: '/academy-events', icon: CalendarDays, permissionKey: 'schedules' },
            { title: '시즌', href: '/seasons', icon: Trophy, permissionKey: 'seasons' },
        ],
    },
    {
        title: '재무 관리',
        icon: CircleDollarSign,
        defaultOpen: true,
        items: [
            { title: '학원비', href: '/payments', icon: CreditCard, permissionKey: 'payments' },
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
            { title: '상담', href: '/consultations', icon: PhoneCall, permissionKey: 'settings' },
            { title: '문자 보내기', href: '/sms', icon: MessageSquare, permissionKey: 'settings' },
            { title: '알림톡 설정', href: '/settings/notifications', icon: BellRing, permissionKey: 'settings' },
        ],
    },
    {
        title: '관리',
        icon: Cog,
        defaultOpen: false,
        items: [
            { title: '성적기록 (추후)', href: '/performance', icon: Award },
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
}

export function Sidebar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<UserState | null>(null);
    const [academyName, setAcademyName] = useState<string>('');

    // 푸시 알림 상태
    const [pushSupported, setPushSupported] = useState(false);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    // 카테고리 펼침 상태
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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

        // 푸시 알림 상태 체크
        checkPushStatus();

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

    const checkPushStatus = async () => {
        const supported = isPushSupported();
        setPushSupported(supported);
        if (supported) {
            const subscription = await getCurrentSubscription();
            setPushSubscribed(!!subscription);
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
                    alert('알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
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

    // 카테고리 내 접근 가능한 아이템이 있는지 확인
    const hasAccessibleItems = (category: NavCategory): boolean => {
        return category.items.some(item => canAccessMenu(item));
    };

    return (
        <aside className="hidden md:flex md:w-64 md:flex-col fixed left-0 top-0 h-full bg-card border-r border-border no-print">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-border">
                <Link href="/" className="flex items-center space-x-2">
                    <Image
                        src="/icons/icon-96x96.png"
                        alt="P-ACA"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-xl font-bold text-foreground">P-ACA</span>
                </Link>
                {/* 푸시 알림 토글 */}
                {mounted && pushSupported && (
                    <div className="relative group">
                        <button
                            onClick={handlePushToggle}
                            disabled={pushLoading}
                            className={`p-2 rounded-lg transition-colors ${
                                pushSubscribed
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
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

            {/* Academy Name */}
            {academyName && (
                <div className="px-4 py-3 border-b border-border bg-muted">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-base font-bold text-foreground truncate">{academyName}</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {/* 대시보드 (항상 상단) */}
                <ul className="space-y-1 mb-2">
                    <li>
                        <Link
                            href={dashboardItem.href}
                            className={cn(
                                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                pathname === dashboardItem.href
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground hover:bg-muted'
                            )}
                        >
                            <LayoutDashboard className={cn('w-5 h-5', pathname === dashboardItem.href ? 'text-primary' : 'text-muted-foreground')} />
                            <span>{dashboardItem.title}</span>
                        </Link>
                    </li>
                </ul>

                {/* 카테고리별 메뉴 */}
                <div className="space-y-1">
                    {navCategories.filter(hasAccessibleItems).map((category) => {
                        const CategoryIcon = category.icon;
                        const isExpanded = expandedCategories[category.title];
                        const hasActiveChild = category.items.some(
                            item => pathname === item.href || pathname.startsWith(item.href + '/')
                        );

                        return (
                            <div key={category.title}>
                                {/* 카테고리 헤더 */}
                                <button
                                    onClick={() => toggleCategory(category.title)}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        hasActiveChild
                                            ? 'bg-primary/5 text-primary'
                                            : 'text-foreground hover:bg-muted'
                                    )}
                                >
                                    <div className="flex items-center space-x-3">
                                        <CategoryIcon className={cn('w-5 h-5', hasActiveChild ? 'text-primary' : 'text-muted-foreground')} />
                                        <span>{category.title}</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>

                                {/* 서브메뉴 */}
                                {isExpanded && (
                                    <ul className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
                                        {category.items.filter(canAccessMenu).map((item) => {
                                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                            const Icon = item.icon;

                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        className={cn(
                                                            'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                                            isActive
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                                                        )}
                                                    >
                                                        <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
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
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Admin Menu (Admin only) */}
                {mounted && isAdmin && (
                    <div className="mt-6">
                        <div className="px-3 mb-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">개발자 전용</h3>
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
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                                    : 'text-foreground hover:bg-muted'
                                            )}
                                        >
                                            <Icon
                                                className={cn('w-5 h-5', isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}
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

            {/* P-EAK 바로가기 */}
            <div className="px-3 pb-2">
                <button
                    onClick={() => {
                        const token = localStorage.getItem('token');
                        const peakUrl = token
                          ? `https://peak-rose.vercel.app/login?token=${encodeURIComponent(token)}`
                          : 'https://peak-rose.vercel.app';
                        window.open(peakUrl, '_blank');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/20 transition-all group"
                >
                    <div className="flex items-center space-x-3">
                        <Mountain className="w-5 h-5 text-orange-500" />
                        <span className="text-orange-600 dark:text-orange-400">P-EAK 실기관리</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-orange-500/70 group-hover:text-orange-500" />
                </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <div className="text-xs text-muted-foreground text-center space-y-1">
                    <div>P-ACA v3.1.19</div>
                    <div className="text-[10px] text-muted-foreground/70">Last updated: 2026-01-06</div>
                    <div>문의: 010-2144-6755</div>
                </div>
            </div>
        </aside>
    );
}
