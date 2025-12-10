import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    iconBgColor?: string;
    iconColor?: string;
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    iconBgColor = 'bg-primary-100',
    iconColor = 'text-primary-600',
}: StatsCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    {/* Icon */}
                    <div className={cn('p-3 rounded-xl', iconBgColor)}>
                        <Icon className={cn('w-6 h-6', iconColor)} />
                    </div>

                    {/* Trend (optional) */}
                    {trend && (
                        <div
                            className={cn(
                                'flex items-center space-x-1 text-sm font-medium',
                                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            )}
                        >
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{trend.value}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="mt-4">
                    <div className="text-sm text-muted-foreground mb-1">{title}</div>
                    <div className="text-3xl font-bold text-foreground">{value}</div>
                </div>
            </CardContent>
        </Card>
    );
}
