'use client';

import { ExternalLink, FileChartColumn, Landmark } from 'lucide-react';
import { SidebarTooltip } from './sidebar-tooltip';

const JUNGSI_ENGINE_URL = process.env.NEXT_PUBLIC_JUNGSI_ENGINE_URL || 'https://seanyjeong.github.io/maxjungsi222/';
const SUSI_ENGINE_URL = process.env.NEXT_PUBLIC_SUSI_ENGINE_URL || 'https://seanyjeong.github.io/26maxsusi/';

interface AdmissionEngineShortcutButtonsProps {
  collapsed: boolean;
}

const shortcuts = [
  {
    href: JUNGSI_ENGINE_URL,
    label: '정시엔진',
    Icon: Landmark,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20',
    iconClassName: 'text-emerald-600',
  },
  {
    href: SUSI_ENGINE_URL,
    label: '수시엔진',
    Icon: FileChartColumn,
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20',
    iconClassName: 'text-violet-600',
  },
];

export function AdmissionEngineShortcutButtons({ collapsed }: AdmissionEngineShortcutButtonsProps) {
  if (collapsed) {
    return (
      <div className="grid gap-2 px-2 pb-2">
        {shortcuts.map(({ href, label, Icon, className, iconClassName }) => (
          <SidebarTooltip key={label} label={label} collapsed={collapsed}>
            <a
              aria-label={label}
              className={`flex w-full items-center justify-center rounded-lg border p-2.5 text-sm font-medium transition-all duration-200 ${className}`}
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              <Icon className={`h-5 w-5 ${iconClassName}`} />
            </a>
          </SidebarTooltip>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 px-2 pb-2">
      {shortcuts.map(({ href, label, Icon, className, iconClassName }) => (
        <a
          key={label}
          className={`group flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${className}`}
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          <div className="flex items-center space-x-3">
            <Icon className={`h-5 w-5 ${iconClassName}`} />
            <span>{label}</span>
          </div>
          <ExternalLink className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </a>
      ))}
    </div>
  );
}
