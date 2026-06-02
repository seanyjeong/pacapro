'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarTooltip } from './sidebar-tooltip';
import { CollapsedCategoryMenu } from './collapsed-category-menu';

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

interface ConsultationCounts {
    newInquiry: number;
    enrolled: number;
}

interface SidebarNavigationProps {
    collapsed: boolean;
    pathname: string;
    mounted: boolean;
    isAdmin: boolean;
    expandedCategories: Record<string, boolean>;
    navCategories: NavCategory[];
    dashboardItem: NavItem;
    adminNavItems: NavItem[];
    consultationCounts: ConsultationCounts;
    canAccessMenu: (item: NavItem) => boolean;
    hasAccessibleItems: (category: NavCategory) => boolean;
    toggleCategory: (title: string) => void;
}

export function SidebarNavigation({
    collapsed,
    pathname,
    mounted,
    isAdmin,
    expandedCategories,
    navCategories,
    dashboardItem,
    adminNavItems,
    consultationCounts,
    canAccessMenu,
    hasAccessibleItems,
    toggleCategory,
}: SidebarNavigationProps) {
    const DashboardIcon = dashboardItem.icon;

    return (
        <nav className={cn("flex-1 py-4 px-2", collapsed ? "overflow-visible" : "overflow-y-auto")}>
            <ul className="space-y-1 mb-2">
                <li>
                    <SidebarTooltip label="대시보드" collapsed={collapsed}>
                        <Link
                            href={dashboardItem.href}
                            className={cn(
                                'flex items-center rounded-lg text-sm font-medium transition-colors',
                                collapsed ? 'justify-center p-2.5' : 'space-x-3 px-3 py-2.5',
                                pathname === dashboardItem.href
                                    ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                                    : 'text-foreground hover:bg-muted/80'
                            )}
                        >
                            <DashboardIcon className={cn('w-5 h-5 flex-shrink-0', pathname === dashboardItem.href ? 'text-primary' : 'text-muted-foreground')} />
                            {!collapsed && <span>{dashboardItem.title}</span>}
                        </Link>
                    </SidebarTooltip>
                </li>
            </ul>

            <div className="space-y-1">
                {navCategories.filter(hasAccessibleItems).map((category) => {
                    const CategoryIcon = category.icon;
                    const isExpanded = expandedCategories[category.title];
                    const hasActiveChild = category.items.some(
                        item => pathname === item.href || pathname.startsWith(item.href + '/')
                    );

                    return (
                        <div key={category.title}>
                            {collapsed ? (
                                <CollapsedCategoryMenu
                                    category={category}
                                    hasActiveChild={hasActiveChild}
                                    pathname={pathname}
                                    canAccessMenu={canAccessMenu}
                                    consultationCounts={consultationCounts}
                                />
                            ) : (
                                <>
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
                                                                    ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                                                                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                                                            )}
                                                        >
                                                            <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                                                            <span>{item.title}</span>
                                                            {item.href === '/consultations/new-inquiry' && consultationCounts.newInquiry > 0 && (
                                                                <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                                    {consultationCounts.newInquiry}
                                                                </span>
                                                            )}
                                                            {item.href === '/consultations/enrolled' && consultationCounts.enrolled > 0 && (
                                                                <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                                    {consultationCounts.enrolled}
                                                                </span>
                                                            )}
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
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {mounted && isAdmin && (
                <div className="mt-6">
                    {!collapsed && (
                        <div className="px-3 mb-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">개발자 전용</h3>
                        </div>
                    )}
                    <ul className="space-y-1">
                        {adminNavItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            const Icon = item.icon;

                            return (
                                <li key={item.href}>
                                    <SidebarTooltip label={item.title} collapsed={collapsed}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'flex items-center rounded-lg text-sm font-medium transition-colors',
                                                collapsed ? 'justify-center p-2.5' : 'space-x-3 px-3 py-2.5',
                                                isActive
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                                    : 'text-foreground hover:bg-muted'
                                            )}
                                        >
                                            <Icon
                                                className={cn('w-5 h-5', isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')}
                                            />
                                            {!collapsed && <span>{item.title}</span>}
                                            {!collapsed && item.badge && (
                                                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </SidebarTooltip>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </nav>
    );
}
