import { StudentSearch } from '@/components/students/student-search';

interface StudentsResultsToolbarProps {
    count: number;
    filterLabels: string[];
    searchQuery: string;
    onSearch: (query: string) => void;
}

export function StudentsResultsToolbar({
    count,
    filterLabels,
    searchQuery,
    onSearch,
}: StudentsResultsToolbarProps) {
    const hasFilters = filterLabels.length > 0;

    return (
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
                <StudentSearch value={searchQuery} onChange={onSearch} />
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                {hasFilters ? (
                    <>
                        <span className="font-medium text-foreground">{filterLabels.join(', ')}</span>
                        <span className="ml-1 font-semibold text-foreground">({count}명)</span>
                    </>
                ) : (
                    <>
                        총 <span className="font-semibold text-foreground">{count}</span>명
                    </>
                )}
            </div>
        </section>
    );
}
