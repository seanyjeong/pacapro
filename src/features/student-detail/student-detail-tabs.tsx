import { cn } from '@/lib/utils';
import type { StudentDetailTab, StudentDetailTabItem } from './student-detail-types';

interface StudentDetailTabsProps {
  activeTab: StudentDetailTab;
  tabs: StudentDetailTabItem[];
  onTabChange: (tab: StudentDetailTab) => void;
}

export function StudentDetailTabs({ activeTab, tabs, onTabChange }: StudentDetailTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1" role="tablist" aria-label="학생 운영 기록">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-selected={active}
              className={cn(
                'inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-slate-900 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
              role="tab"
              type="button"
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {tab.count ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
