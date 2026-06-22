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
    <div className="border-b border-border">
      <nav className="flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </nav>
    </div>
  );
}
