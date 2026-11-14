'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { SidebarTooltip } from './sidebar-tooltip';
import {
    adminNavItems,
    canAccessNavItem,
    dashboardItem,
    findActiveHref,
    isNavAdmin,
    navCategories,
    type NavItem,
    type NavUser,
} from './nav-config';
import type { ConsultationCounts } from './use-nav-data';

interface SidebarNavigationProps {
    collapsed: boolean;
    pathname: string;
    mounted: boolean;
    user: NavUser | null;
    consultationCounts: ConsultationCounts;
}

export function countForItem(href: string, counts: ConsultationCounts): number {
    if (href === '/consultations/new-inquiry') return counts.newInquiry;
    if (href === '/consultations/enrolled') return counts.enrolled;
    return 0;
}

function NavLink({ item, active, collapsed, count }: { item: NavItem; active: boolean; collapsed: boolean; count: number }) {
    const Icon = item.icon;
    return (
        <SidebarTooltip label={item.title} collapsed={collapsed}>
            <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                    'relative flex items-center rounded-xl text-[15px] transition-colors',
                    collapsed ? 'h-11 justify-center' : 'h-10 gap-3 px-3',
                    active ? 'bg-muted font-bold text-foreground' : 'font-medium text-secondary-foreground hover:bg-muted/70 hover:text-foreground'
                )}
            >
                <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                {!collapsed && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
                {count > 0 && (
                    <span className={cn(
                        'rounded-full bg-destructive text-[11px] font-bold leading-none text-destructive-foreground',
                        collapsed ? 'absolute right-1.5 top-1.5 h-2 w-2 p-0 text-[0px]' : 'px-1.5 py-1'
                    )}>
                        {count}
                    </span>
                )}
                {!collapsed && item.badge && (
                    <span className="rounded-full bg-destructive px-1.5 py-1 text-[11px] font-bold leading-none text-destructive-foreground">{item.badge}</span>
                )}
            </Link>
        </SidebarTooltip>
    );
}

export function SidebarNavigation({ collapsed, pathname, mounted, user, consultationCounts }: SidebarNavigationProps) {
    const activeHref = findActiveHref(pathname);
    const categories = navCategories
        .map((category) => ({ ...category, items: category.items.filter((item) => canAccessNavItem(item, user, mounted)) }))
        .filter((category) => category.items.length > 0);

    return (
        <nav className={cn('flex-1 overflow-y-auto pb-3', collapsed ? 'px-2' : 'px-3')}>
            <NavLink item={dashboardItem} active={activeHref === dashboardItem.href} collapsed={collapsed} count={0} />

            {categories.map((category) => (
                <section key={category.title} className={cn(collapsed ? 'mt-2 border-t border-border/60 pt-2' : 'mt-5')}>
                    {!collapsed && <h3 className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{category.title}</h3>}
                    <ul className="space-y-0.5">
                        {category.items.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} active={activeHref === item.href} collapsed={collapsed} count={countForItem(item.href, consultationCounts)} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {mounted && isNavAdmin(user) && (
                <section className={cn(collapsed ? 'mt-2 border-t border-border/60 pt-2' : 'mt-5')}>
                    {!collapsed && <h3 className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">개발자 전용</h3>}
                    <ul className="space-y-0.5">
                        {adminNavItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} active={activeHref === item.href} collapsed={collapsed} count={0} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </nav>
    );
}
