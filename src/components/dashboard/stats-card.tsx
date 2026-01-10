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
        bar: 'bg-blue-500',
        iconBg: 'bg-blue-50 dark:bg-blue-950/50',
        iconColor: 'text-blue-600 dark:text-blue-400',
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
        bar: 'bg-emerald-500',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
        bar: 'bg-amber-500',
        iconBg: 'bg-amber-50 dark:bg-amber-950/50',
        iconColor: 'text-amber-600 dark:text-amber-400',
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
            'hover:-translate-y-1'
        )}>
            {/* 상단 컬러 바 - 호버시 표시 */}
            <div className={cn(
                'absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                accent.bar
            )} />

            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    {/* Icon with subtle glow */}
                    <div className={cn(
                        'p-3 rounded-xl transition-all duration-300',
                        'group-hover:scale-105',
                        iconBgColor || accent.iconBg
                    )}>
                        <Icon className={cn(
                            'w-6 h-6 transition-colors duration-300',
                            iconColor || accent.iconColor
                        )} />
                    </div>

                    {/* Trend (optional) */}
                    {trend && (
                        <div
                            className={cn(
                                'flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full',
                                trend.isPositive
                                    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50'
                                    : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/50'
                            )}
                        >
                            <span className="text-xs">{trend.isPositive ? '▲' : '▼'}</span>
                            <span>{trend.value}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="mt-4 space-y-1">
                    <div className="text-sm font-medium text-muted-foreground tracking-wide">
                        {title}
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">
                        {value}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
