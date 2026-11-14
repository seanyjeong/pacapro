import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type AccentColor = 'blue' | 'cyan' | 'violet' | 'emerald' | 'amber';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    accentColor?: AccentColor;
    iconBgColor?: string;
    iconColor?: string;
}

const accentStyles: Record<AccentColor, { bar: string; iconBg: string; iconColor: string }> = {
    blue: {
        bar: 'bg-primary',
        iconBg: 'bg-primary-soft',
        iconColor: 'text-primary',
    },
    cyan: {
        bar: 'bg-cyan-500',
        iconBg: 'bg-cyan-50 dark:bg-cyan-950/50',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
    },
    violet: {
        bar: 'bg-violet-500',
        iconBg: 'bg-violet-50 dark:bg-violet-950/50',
        iconColor: 'text-violet-600 dark:text-violet-400',
    },
    emerald: {
        bar: 'bg-success',
        iconBg: 'bg-success-soft',
        iconColor: 'text-success',
    },
    amber: {
        bar: 'bg-warning',
        iconBg: 'bg-warning-soft',
        iconColor: 'text-warning',
    },
};

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    accentColor = 'blue',
    iconBgColor,
    iconColor,
}: StatsCardProps) {
    const accent = accentStyles[accentColor];

    return (
        <Card className={cn(
            'group relative overflow-hidden transition-all duration-300',
            'hover:-translate-y-1 hover:shadow-[0_8px_24px_0_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_0_rgba(0,0,0,0.16)]',
            'cursor-pointer'
        )}>
            {/* 상단 컬러 바 - 항상 표시, 호버시 더 강조 */}
            <div className={cn(
                'absolute top-0 left-0 right-0 h-1 opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:h-1.5',
                accent.bar
            )} />

            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    {/* Icon */}
                    <div className={cn(
                        'p-3 rounded-xl transition-all duration-300',
                        'group-hover:scale-110 group-hover:rotate-3',
                        iconBgColor || accent.iconBg
                    )}>
                        <Icon className={cn(
                            'w-6 h-6 transition-transform duration-300',
                            iconColor || accent.iconColor
                        )} />
                    </div>

                    {/* Trend (optional) */}
                    {trend && (
                        <div
                            className={cn(
                                'flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full',
                                trend.isPositive
                                    ? 'text-success bg-success-soft'
                                    : 'text-destructive bg-destructive-soft'
                            )}
                        >
                            <span className="text-xs">{trend.isPositive ? '▲' : '▼'}</span>
                            <span>{trend.value}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="mt-4 space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {title}
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground transition-transform duration-300 group-hover:scale-105">
                        {value}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
