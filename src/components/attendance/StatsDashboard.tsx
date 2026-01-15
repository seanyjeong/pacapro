'use client';

import { useEffect, useState } from 'react';
import { Users, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Stats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
}

interface StatsDashboardProps {
  stats: Stats;
  layout?: 'horizontal' | 'vertical' | 'grid';
  className?: string;
}

function CountUpNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let start = 0;
      const duration = 300;
      const increment = value / (duration / 16);
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return <span className="animate-count-up">{count}</span>;
}

export function StatsDashboard({ stats, layout = 'grid', className = '' }: StatsDashboardProps) {
  const presentRate = stats.total > 0 
    ? Math.round((stats.present / stats.total) * 100) 
    : 0;

  const statItems = [
    { 
      key: 'total', 
      label: '전체', 
      value: stats.total, 
      icon: Users,
      color: 'text-slate-700 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-slate-800'
    },
    { 
      key: 'present', 
      label: '출석', 
      value: stats.present, 
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950'
    },
    { 
      key: 'absent', 
      label: '결석', 
      value: stats.absent, 
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950'
    },
    { 
      key: 'late', 
      label: '지각', 
      value: stats.late, 
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950'
    },
    { 
      key: 'notMarked', 
      label: '미체크', 
      value: stats.notMarked, 
      icon: AlertCircle,
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-50 dark:bg-slate-900'
    },
  ];

  if (layout === 'horizontal') {
    return (
      <div className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}>
        {statItems.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`${item.bg} rounded-xl p-3 text-center min-w-[72px] flex-1 shadow-sm`}
          >
            <p className={`text-xl sm:text-2xl font-bold font-mono ${item.color}`}>
              <CountUpNumber value={item.value} delay={index * 50} />
            </p>
            <p className={`text-[10px] sm:text-xs ${item.color} mt-1`}>{item.label}</p>
          </motion.div>
        ))}
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={`glass-strong rounded-2xl p-5 ${className}`}>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          실시간 통계
        </h3>
        
        {/* Progress Ring */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-secondary"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="56"
                stroke="url(#gradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 352' }}
                animate={{ 
                  strokeDasharray: `${(presentRate / 100) * 352} 352` 
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--attendance-present-from))" />
                  <stop offset="100%" stopColor="hsl(var(--attendance-present-to))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-bold font-mono">
                <CountUpNumber value={presentRate} />%
              </span>
              <span className="text-xs text-muted-foreground">출석률</span>
            </div>
          </div>
        </div>

        {/* Stats List */}
        <div className="space-y-3">
          {statItems.map((item, index) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              <span className={`text-lg font-bold font-mono ${item.color}`}>
                <CountUpNumber value={item.value} delay={index * 80} />
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Grid layout (default)
  return (
    <div className={`grid grid-cols-5 gap-2 sm:gap-3 ${className}`}>
      {statItems.map((item, index) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className={`${item.bg} rounded-xl p-2 sm:p-3 text-center shadow-sm`}
        >
          <p className={`text-xl sm:text-2xl font-bold font-mono ${item.color}`}>
            <CountUpNumber value={item.value} delay={index * 50} />
          </p>
          <p className={`text-[10px] sm:text-xs ${item.color} mt-0.5 sm:mt-1`}>{item.label}</p>
        </motion.div>
      ))}
    </div>
  );
}