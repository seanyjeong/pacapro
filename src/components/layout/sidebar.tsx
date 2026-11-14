'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import releaseInfo from '../../constants/release.json';
import { Bell, BellOff, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import {
    pushAPI,
    isPushSupported,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    getCurrentSubscription,
} from '@/lib/api/push';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarShortcuts } from './sidebar-shortcuts';
import { readNavUser, type NavUser } from './nav-config';
import { useAcademyName, useConsultationCounts } from './use-nav-data';

export function Sidebar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<NavUser | null>(null);
    const academyName = useAcademyName();
    const consultationCounts = useConsultationCounts();

    // 사이드바 접힘 상태 (기본: 펼침)
    const [collapsed, setCollapsed] = useState(false);

    // 푸시 알림 상태
    const [pushSupported, setPushSupported] = useState(false);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    // 클라이언트에서만 사용자 정보 로드 (hydration 문제 방지)
    useEffect(() => {
        setUser(readNavUser());
        setMounted(true);
        const savedCollapsed = localStorage.getItem('sidebar_collapsed');
        if (savedCollapsed !== null) {
            setCollapsed(savedCollapsed === 'true');
        }
        checkPushStatus();
    }, []);

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

    return (
        <aside
            className={cn(
                'no-print fixed left-0 top-0 z-40 hidden h-full flex-col bg-card transition-[width] duration-300 ease-in-out md:flex',
                collapsed ? 'w-[76px]' : 'w-[248px]'
            )}
        >
            {/* 로고 · 학원명 */}
            <div className={cn('flex h-[72px] shrink-0 items-center', collapsed ? 'justify-center px-2' : 'gap-2.5 px-5')}>
                <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="대시보드로 가기">
                    <Image src="/icons/icon-96x96.png" alt="P-ACA" width={36} height={36} className="shrink-0 rounded-xl" />
                    {!collapsed && (
                        <span className="min-w-0">
                            <span className="block text-[17px] font-extrabold leading-tight tracking-tight text-foreground">P-ACA</span>
                            {academyName && <span className="block truncate text-xs font-medium text-muted-foreground">{academyName}</span>}
                        </span>
                    )}
                </Link>
                {!collapsed && mounted && pushSupported && (
                    <button
                        type="button"
                        aria-label={pushSubscribed ? '미납자 푸시 알림 끄기' : '미납자 푸시 알림 켜기'}
                        title={pushSubscribed ? '미납자 알림 켜짐 — 눌러서 끄기' : '미납자 알림 꺼짐 — 눌러서 켜기'}
                        onClick={handlePushToggle}
                        disabled={pushLoading}
                        className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50',
                            pushSubscribed ? 'bg-success-soft text-success' : 'text-muted-foreground hover:bg-muted'
                        )}
                    >
                        {pushLoading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : pushSubscribed ? <Bell className="h-[18px] w-[18px]" /> : <BellOff className="h-[18px] w-[18px]" />}
                    </button>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNavigation
                    collapsed={collapsed}
                    pathname={pathname}
                    mounted={mounted}
                    user={user}
                    consultationCounts={consultationCounts}
                />
                <SidebarShortcuts collapsed={collapsed} />
            </div>

            {/* 접기 · 버전 */}
            <div className={cn('flex shrink-0 items-center border-t border-border/60 py-3', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
                {!collapsed && (
                    <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground/80">
                        <div>P-ACA v{releaseInfo.version}</div>
                        <div>문의 010-2144-6755</div>
                    </div>
                )}
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                    title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
                </button>
            </div>
        </aside>
    );
}
