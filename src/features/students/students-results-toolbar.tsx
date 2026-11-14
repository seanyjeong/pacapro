import type { ReactNode } from 'react';
import { StudentSearch } from '@/components/students/student-search';

interface StudentsResultsToolbarProps {
    count: number;
    filterLabels: string[];
    filters?: ReactNode;
    searchQuery: string;
    onSearch: (query: string) => void;
}

export function StudentsResultsToolbar({
    count,
    filterLabels,
    filters,
    searchQuery,
    onSearch,
}: StudentsResultsToolbarProps) {
    const hasFilters = filterLabels.length > 0;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="min-w-0 lg:w-80 lg:shrink-0">
                    <StudentSearch value={searchQuery} onChange={onSearch} />
                </div>
                {filters}
            </div>
            <p className="text-[13px] text-muted-foreground">
                {hasFilters && <span className="font-semibold text-secondary-foreground">{filterLabels.join(', ')} · </span>}
                총 <span className="font-bold tabular-nums text-foreground">{count}</span>명
            </p>
        </div>
    );
}
