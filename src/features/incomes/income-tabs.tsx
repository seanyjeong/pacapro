import { Button } from '@/components/ui/button';
import type { IncomeTab } from './incomes-types';

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
    <nav className="flex flex-wrap gap-1.5" aria-label="수입 구분">
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          type="button"
          size="sm"
          variant={activeTab === tab.value ? 'secondary' : 'outline'}
          aria-pressed={activeTab === tab.value}
          onClick={() => onTabChange(tab.value)}
        >
          {tab.label} ({tab.count})
        </Button>
      ))}
    </nav>
  );
}
