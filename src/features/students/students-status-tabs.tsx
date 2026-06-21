import { cn } from '@/lib/utils/cn';
import type { StudentTab } from './student-page-types';
import { STUDENT_TABS } from './student-page-utils';

interface StudentsStatusTabsProps {
    activeTab: StudentTab;
    onChange: (tab: StudentTab) => void;
}

export function StudentsStatusTabs({ activeTab, onChange }: StudentsStatusTabsProps) {
    return (
        <section className="overflow-x-auto rounded-lg border border-border bg-card">
            <div className="flex min-w-max">
                {STUDENT_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                'flex w-[124px] shrink-0 items-center gap-2 border-r border-border px-3 py-3 text-left last:border-r-0 transition-colors sm:w-[148px] sm:gap-3 sm:px-4',
                                active ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                            )}
                        >
                            <Icon className={cn('h-4 w-4 shrink-0', active ? tab.toneClass : 'text-muted-foreground')} />
                            <span className="min-w-0">
                                <span className="block whitespace-nowrap text-sm font-semibold">{tab.label}</span>
                                <span className="mt-0.5 hidden whitespace-nowrap text-xs text-muted-foreground sm:block">{tab.description}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
