'use client';

import { Activity, ExternalLink } from 'lucide-react';
import { SidebarTooltip } from './sidebar-tooltip';

const MOVEMENT_ANALYSIS_URL = 'https://www.performetrics.co.kr/';

interface MovementAnalysisShortcutButtonProps {
  collapsed: boolean;
}

export function MovementAnalysisShortcutButton({ collapsed }: MovementAnalysisShortcutButtonProps) {
  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <SidebarTooltip label="동작분석사이트" collapsed={collapsed}>
          <a
            aria-label="동작분석사이트"
            className="flex w-full items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-sm font-medium transition-all duration-200 hover:bg-sky-500/20"
            href={MOVEMENT_ANALYSIS_URL}
            rel="noreferrer"
            target="_blank"
          >
            <Activity className="h-5 w-5 text-sky-600" />
          </a>
        </SidebarTooltip>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <a
        className="group flex w-full items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-sky-500/20"
        href={MOVEMENT_ANALYSIS_URL}
        rel="noreferrer"
        target="_blank"
      >
        <div className="flex items-center space-x-3">
          <Activity className="h-5 w-5 text-sky-600" />
          <span className="text-sky-700 dark:text-sky-300">동작분석사이트</span>
        </div>
        <ExternalLink className="h-4 w-4 text-sky-600/70 group-hover:text-sky-600" />
      </a>
    </div>
  );
}
