import { cn } from '@/lib/utils/cn';
import type { StudentTab } from './student-page-types';
import { STUDENT_TABS } from './student-page-utils';

interface StudentsStatusTabsProps {
    activeTab: StudentTab;
    onChange: (tab: StudentTab) => void;
}

export function StudentsStatusTabs({ activeTab, onChange }: StudentsStatusTabsProps) {
    return (
        <div className="scrollbar-none -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6" role="tablist" aria-label="학생 상태">
            <div className="flex w-max gap-1.5">
                {STUDENT_TABS.map((tab) => {
                    const active = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-label={`${tab.label} ${tab.description}`}
                            title={tab.description}
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors',
                                active ? 'bg-foreground text-background' : 'bg-muted text-secondary-foreground hover:text-foreground'
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
