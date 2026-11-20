'use client';

import { Activity, ArrowUpRight, Landmark, Mountain } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { openPeakSso } from '@/lib/peak-sso';
import { SidebarTooltip } from './sidebar-tooltip';

// 수시·정시 통합엔진(예전 정시엔진·수시엔진 바로가기를 대신한다)
const MAX_ENGINE_URL = 'https://engine.supermax.kr/';
const MOVEMENT_ANALYSIS_URL = 'https://www.performetrics.co.kr/';

type Shortcut =
    | { label: string; Icon: React.ComponentType<{ className?: string }>; tint: string; href: string }
    | { label: string; Icon: React.ComponentType<{ className?: string }>; tint: string; onClick: () => void };

const shortcuts: Shortcut[] = [
    { label: 'P-EAK 실기관리', Icon: Mountain, tint: 'bg-warning/10 text-warning', onClick: () => { void openPeakSso(); } },
    { label: '통합엔진', Icon: Landmark, tint: 'bg-success/10 text-success', href: MAX_ENGINE_URL },
    { label: '동작분석', Icon: Activity, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', href: MOVEMENT_ANALYSIS_URL },
];

// 외부 서비스 바로가기. 새 창으로 열린다.
export function SidebarShortcuts({ collapsed }: { collapsed: boolean }) {
    return (
        <div className={cn('pb-2', collapsed ? 'px-2' : 'px-3')}>
            {!collapsed && <p className="px-3 pb-1.5 pt-3 text-xs font-semibold text-muted-foreground">바로가기</p>}
            <ul className="grid gap-0.5">
                {shortcuts.map((shortcut) => {
                    const { label, Icon, tint } = shortcut;
                    const className = cn(
                        'group flex w-full items-center rounded-xl text-[13px] font-semibold text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground',
                        collapsed ? 'justify-center p-2' : 'h-10 gap-3 px-3'
                    );
                    const content = (
                        <>
                            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', tint)}>
                                <Icon className="h-4 w-4" />
                            </span>
                            {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
                            {!collapsed && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-80" />}
                        </>
                    );
                    return (
                        <li key={label}>
                            <SidebarTooltip label={label} collapsed={collapsed}>
                                {'href' in shortcut ? (
                                    <a aria-label={label} className={className} href={shortcut.href} rel="noreferrer" target="_blank">{content}</a>
                                ) : (
                                    <button type="button" aria-label={label} className={className} onClick={shortcut.onClick}>{content}</button>
                                )}
                            </SidebarTooltip>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
