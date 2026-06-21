'use client';

import { ExternalLink, Mountain } from 'lucide-react';
import { openPeakSso } from '@/lib/peak-sso';
import { SidebarTooltip } from './sidebar-tooltip';

interface PeakShortcutButtonProps {
  collapsed: boolean;
}

export function PeakShortcutButton({ collapsed }: PeakShortcutButtonProps) {
  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <SidebarTooltip label="P-EAK 실기관리" collapsed={collapsed}>
          <button
            onClick={() => { void openPeakSso(); }}
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-sm font-medium bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-all duration-200"
          >
            <Mountain className="w-5 h-5 text-orange-500" />
          </button>
        </SidebarTooltip>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <button
        onClick={() => { void openPeakSso(); }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition-all duration-200 group"
      >
        <div className="flex items-center space-x-3">
          <Mountain className="w-5 h-5 text-orange-500" />
          <span className="text-orange-600 dark:text-orange-400">P-EAK 실기관리</span>
        </div>
        <ExternalLink className="w-4 h-4 text-orange-500/70 group-hover:text-orange-500" />
      </button>
    </div>
  );
}
