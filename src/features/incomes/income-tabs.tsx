import type { IncomeTab } from './incomes-types';
import { cn } from '@/lib/utils/cn';

interface IncomeTabsProps {
  activeTab: IncomeTab;
  tuitionCount: number;
  otherCount: number;
  onTabChange: (tab: IncomeTab) => void;
}

export function IncomeTabs({ activeTab, tuitionCount, otherCount, onTabChange }: IncomeTabsProps) {
  const tabs: Array<{ value: IncomeTab; label: string; count: number }> = [
    { value: 'all', label: '전체', count: tuitionCount + otherCount },
    { value: 'tuition', label: '학원비 수납', count: tuitionCount },
    { value: 'other', label: '기타 수입', count: otherCount },
  ];

  return (
    <div className="rounded-md border border-border bg-card p-1 shadow-none">
      <nav className="grid grid-cols-3 gap-1" aria-label="수입 구분">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'min-w-0 rounded px-2 py-2 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/55 hover:text-foreground'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </nav>
    </div>
  );
}
