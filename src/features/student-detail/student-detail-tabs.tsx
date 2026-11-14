import { cn } from '@/lib/utils';
import type { StudentDetailTab, StudentDetailTabItem } from './student-detail-types';

interface StudentDetailTabsProps {
  activeTab: StudentDetailTab;
  tabs: StudentDetailTabItem[];
  onTabChange: (tab: StudentDetailTab) => void;
}

export function StudentDetailTabs({ activeTab, tabs, onTabChange }: StudentDetailTabsProps) {
  return (
    <div className="scrollbar-none overflow-x-auto">
      <div className="inline-flex min-w-max gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="학생 운영 기록">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-selected={active}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors',
                active
                  ? 'bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              role="tab"
              type="button"
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {tab.count ? (
                <span className="text-xs tabular-nums text-muted-foreground">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
