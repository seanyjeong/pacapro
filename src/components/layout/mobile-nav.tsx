'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, CreditCard, Home, LayoutGrid, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarShortcuts } from './sidebar-shortcuts';
import { countForItem } from './sidebar-navigation';
import {
    adminNavItems,
    canAccessNavItem,
    findActiveHref,
    isNavAdmin,
    navCategories,
    readNavUser,
    type NavItem,
    type NavUser,
} from './nav-config';
import { useAcademyName, useConsultationCounts } from './use-nav-data';

const TABS: NavItem[] = [
    { title: '홈', href: '/', icon: Home },
    { title: '학생', href: '/students', icon: Users, permissionKey: 'students' },
    { title: '수업', href: '/schedules', icon: Calendar, permissionKey: 'schedules' },
    { title: '학원비', href: '/payments', icon: CreditCard, permissionKey: 'payments' },
];

// 휴대폰 폭에서 쓰는 아래 탭 + 전체 메뉴. PC 폭(md 이상)에서는 사이드바를 쓴다.
export function MobileNav({ menuOpen, onMenuOpenChange }: { menuOpen: boolean; onMenuOpenChange: (open: boolean) => void }) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<NavUser | null>(null);
    const academyName = useAcademyName();
    const consultationCounts = useConsultationCounts();

    useEffect(() => {
        setUser(readNavUser());
        setMounted(true);
    }, []);

    // 메뉴에서 다른 화면으로 가면 시트를 닫는다.
    useEffect(() => {
        onMenuOpenChange(false);
    }, [pathname, onMenuOpenChange]);

    const activeHref = findActiveHref(pathname);
    const tabs = TABS.filter((tab) => canAccessNavItem(tab, user, mounted));
    const tabActive = (href: string) => (href === '/' ? pathname === '/' : activeHref === href || pathname.startsWith(href + '/'));
    const categories = navCategories
        .map((category) => ({ ...category, items: category.items.filter((item) => canAccessNavItem(item, user, mounted)) }))
        .filter((category) => category.items.length > 0);

    return (
        <>
            <nav
                aria-label="아래 메뉴"
                className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            >
                <ul className="mx-auto flex max-w-lg">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = !menuOpen && tabActive(tab.href);
                        return (
                            <li key={tab.href} className="flex-1">
                                <Link
                                    href={tab.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn('flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}
                                >
                                    <Icon className={cn('h-6 w-6', active && 'text-primary')} />
                                    {tab.title}
                                </Link>
                            </li>
                        );
                    })}
                    <li className="flex-1">
                        <button
                            type="button"
                            aria-expanded={menuOpen}
                            onClick={() => onMenuOpenChange(!menuOpen)}
                            className={cn('flex h-[60px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', menuOpen ? 'text-foreground' : 'text-muted-foreground')}
                        >
                            <LayoutGrid className={cn('h-6 w-6', menuOpen && 'text-primary')} />
                            전체
                        </button>
                    </li>
                </ul>
            </nav>

            {menuOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden" role="dialog" aria-modal="true" aria-label="전체 메뉴">
                    <div className="flex h-14 shrink-0 items-center justify-between px-5">
                        <div className="min-w-0">
                            <p className="text-lg font-extrabold tracking-tight text-foreground">전체</p>
                            {academyName && <p className="truncate text-xs font-medium text-muted-foreground">{academyName}</p>}
                        </div>
                        <button type="button" onClick={() => onMenuOpenChange(false)} aria-label="전체 메뉴 닫기" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                        {categories.map((category) => (
                            <section key={category.title} className="rounded-2xl bg-card p-2">
                                <h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{category.title}</h3>
                                <ul className="grid grid-cols-2 gap-1">
                                    {category.items.map((item) => {
                                        const Icon = item.icon;
                                        const count = countForItem(item.href, consultationCounts);
                                        const active = activeHref === item.href;
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={cn('flex h-12 items-center gap-2.5 rounded-xl px-3 text-[15px]', active ? 'bg-muted font-bold text-foreground' : 'font-medium text-foreground hover:bg-muted')}
                                                >
                                                    <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                                                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                                    {count > 0 && <span className="rounded-full bg-destructive px-1.5 py-1 text-[11px] font-bold leading-none text-destructive-foreground">{count}</span>}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                        {mounted && isNavAdmin(user) && (
                            <section className="rounded-2xl bg-card p-2">
                                <h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">개발자 전용</h3>
                                <ul className="grid grid-cols-2 gap-1">
                                    {adminNavItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.href}>
                                                <Link href={item.href} className="flex h-12 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium text-foreground hover:bg-muted">
                                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                                    {item.title}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}
                        <section className="rounded-2xl bg-card py-1">
                            <SidebarShortcuts collapsed={false} />
                        </section>
                    </div>
                </div>
            )}
        </>
    );
}
